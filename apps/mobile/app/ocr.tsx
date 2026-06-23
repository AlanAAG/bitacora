import { useState } from 'react';
import { View, Image, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';

// ponytail: timestamped filename per car — unique enough for uploads, no uuid dep.
type OCRResult = {
  records?: any[];
  confidence?: number;
  warnings?: string[];
};

export default function OCRScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OCRResult | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const processImage = async () => {
    if (!imageUri || !carId) return;
    setLoading(true);

    const filename = `${carId}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('ocr-photos')
      .upload(filename, { uri: imageUri, type: 'image/jpeg', name: filename } as any);

    if (uploadError) { Alert.alert('Error subiendo imagen'); setLoading(false); return; }

    const { data: job } = await supabase.from('ocr_jobs').insert({
      car_id: carId,
      image_url: `ocr-photos/${filename}`,
      status: 'pending',
    }).select().single();

    const { error: fnError } = await supabase.functions.invoke('ocr-agent', {
      body: { job_id: job!.id },
    });

    if (fnError) { Alert.alert('Error procesando imagen'); setLoading(false); return; }

    const { data: result } = await supabase
      .from('ocr_jobs').select('*').eq('id', job!.id).single();

    setResults(result?.extracted_data ?? null);
    setLoading(false);
  };

  const SERVICE_VALUES = ['oil_change', 'tire_rotation', 'brake_service', 'transmission', 'air_filter', 'spark_plugs', 'coolant', 'battery', 'alignment', 'inspection', 'other'];

  const importRecords = async () => {
    if (!results?.records || !carId) return;
    let ok = 0, skipped = 0;
    for (const record of results.records) {
      // Validate AI output before insert: required fields + known enum values.
      const services = Array.isArray(record?.services)
        ? record.services.filter((s: string) => SERVICE_VALUES.includes(s))
        : [];
      const mileage = Number(record?.mileage_at_service);
      if (!record?.service_date || !/^\d{4}-\d{2}-\d{2}$/.test(record.service_date) || !Number.isFinite(mileage) || services.length === 0) {
        skipped++; continue;
      }
      const { error } = await supabase.from('service_records').insert({
        car_id: carId,
        service_date: record.service_date,
        mileage_at_service: mileage,
        shop_name: record.shop_name ?? null,
        services,
        description: record.description ?? null,
        total_cost_mxn: record.total_cost_mxn ?? null,
        notes: record.notes ?? null,
        imported_via_ocr: true,
        parts_replaced: [],
      });
      if (error) skipped++; else ok++;
    }
    Alert.alert('Importado', `${ok} registros importados${skipped ? `, ${skipped} omitidos (datos incompletos)` : ''}.`,
      [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>Importar bitácora</Text>
      <Text variant="bodyMedium" style={styles.sub}>
        Toma una foto de la página de tu bitácora física. La IA extrae los registros automáticamente.
      </Text>
      <View style={styles.buttons}>
        <Button mode="outlined" onPress={takePhoto} icon="camera" style={styles.btn}>
          Tomar foto
        </Button>
        <Button mode="outlined" onPress={pickImage} icon="image" style={styles.btn}>
          Galería
        </Button>
      </View>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
      )}
      {imageUri && !results && (
        <Button mode="contained" onPress={processImage} loading={loading} style={styles.processBtn}>
          {loading ? 'Procesando...' : 'Extraer registros con IA'}
        </Button>
      )}
      {results && (
        <Card style={styles.results}>
          <Card.Content>
            <Text variant="titleMedium">Resultados</Text>
            <Text>{results.records?.length || 0} registros encontrados</Text>
            <Text style={styles.confidence}>Confianza: {Math.round((results.confidence || 0) * 100)}%</Text>
            {results.warnings?.map((w: string, i: number) => (
              <Text key={i} style={styles.warning}>{w}</Text>
            ))}
            <Button mode="contained" onPress={importRecords} style={styles.importBtn}>
              Importar todos
            </Button>
          </Card.Content>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontWeight: 'bold', marginBottom: 8 },
  sub: { color: '#666', marginBottom: 24 },
  buttons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  btn: { flex: 1 },
  preview: { width: '100%', height: 240, marginBottom: 16, borderRadius: 8 },
  processBtn: { marginBottom: 16 },
  results: { marginTop: 8 },
  confidence: { color: '#666', marginTop: 4 },
  warning: { color: '#f59e0b', marginTop: 4 },
  importBtn: { marginTop: 12 },
});

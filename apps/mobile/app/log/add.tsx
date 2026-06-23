import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, Chip } from 'react-native-paper';
import { useServiceLog } from '../../hooks/useServiceLog';
import { useParts } from '../../hooks/useParts';
import { router, useLocalSearchParams } from 'expo-router';
import { ServiceType } from '../../types';

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'oil_change', label: 'Aceite' },
  { value: 'tire_rotation', label: 'Llantas' },
  { value: 'brake_service', label: 'Frenos' },
  { value: 'air_filter', label: 'Filtro aire' },
  { value: 'spark_plugs', label: 'Bujías' },
  { value: 'coolant', label: 'Anticongelante' },
  { value: 'battery', label: 'Batería' },
  { value: 'alignment', label: 'Alineación' },
  { value: 'inspection', label: 'Revisión' },
  { value: 'other', label: 'Otro' },
];

export default function AddServiceRecordScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { addRecord } = useServiceLog(carId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { addPart } = useParts(carId);

  const [form, setForm] = useState({
    service_date: new Date().toISOString().split('T')[0],
    mileage_at_service: '',
    shop_name: '',
    description: '',
    total_cost_mxn: '',
    notes: '',
  });
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleService = (s: ServiceType) =>
    setSelectedServices(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );

  const handleSubmit = async () => {
    if (!carId || !form.mileage_at_service || selectedServices.length === 0) {
      setError('Kilometraje y tipo de servicio son requeridos.');
      return;
    }
    setLoading(true);
    const { error } = await addRecord({
      car_id: carId,
      service_date: form.service_date,
      mileage_at_service: parseInt(form.mileage_at_service),
      shop_name: form.shop_name || undefined,
      services: selectedServices,
      description: form.description || undefined,
      total_cost_mxn: form.total_cost_mxn ? parseFloat(form.total_cost_mxn) : undefined,
      notes: form.notes || undefined,
      parts_replaced: [],
      imported_via_ocr: false,
    });
    if (error) setError(error.message);
    else router.back();
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>Nuevo servicio</Text>
      <TextInput label="Fecha (YYYY-MM-DD)" value={form.service_date}
        onChangeText={v => setForm(f => ({ ...f, service_date: v }))} style={styles.input} />
      <TextInput label="Kilometraje *" value={form.mileage_at_service}
        onChangeText={v => setForm(f => ({ ...f, mileage_at_service: v }))}
        keyboardType="numeric" style={styles.input} />
      <TextInput label="Taller / Mecánico" value={form.shop_name}
        onChangeText={v => setForm(f => ({ ...f, shop_name: v }))} style={styles.input} />
      <Text variant="labelMedium" style={styles.label}>Tipo de servicio *</Text>
      <View style={styles.chips}>
        {SERVICE_OPTIONS.map(s => (
          <Chip key={s.value} selected={selectedServices.includes(s.value)}
            onPress={() => toggleService(s.value)} style={styles.chip}>
            {s.label}
          </Chip>
        ))}
      </View>
      <TextInput label="Descripción" value={form.description}
        onChangeText={v => setForm(f => ({ ...f, description: v }))}
        multiline style={styles.input} />
      <TextInput label="Costo total (MXN)" value={form.total_cost_mxn}
        onChangeText={v => setForm(f => ({ ...f, total_cost_mxn: v }))}
        keyboardType="numeric" style={styles.input} />
      <TextInput label="Notas" value={form.notes}
        onChangeText={v => setForm(f => ({ ...f, notes: v }))}
        multiline style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleSubmit} loading={loading} style={styles.btn}>
        Guardar
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  title: { fontWeight: 'bold', marginBottom: 20 },
  input: { marginBottom: 12 },
  label: { marginBottom: 8, color: '#666' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  chip: { margin: 4 },
  btn: { marginTop: 8 },
  error: { color: 'red', marginBottom: 8 },
});

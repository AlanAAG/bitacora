import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons, Menu } from 'react-native-paper';
import { useCars } from '../../hooks/useCars';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

// Top 20 car brands in Mexico by sales (AMDA 2024)
const MX_BRANDS = ['Nissan', 'General Motors', 'KIA', 'Toyota', 'Volkswagen', 'Stellantis',
  'Ford', 'Honda', 'Hyundai', 'Mazda', 'Suzuki', 'Audi', 'BMW', 'Mercedes-Benz',
  'Seat', 'Jeep', 'RAM', 'Chevrolet', 'Acura', 'Infiniti'];

export default function AddCarScreen() {
  const { addCar } = useCars();
  const [brand, setBrand] = useState('');
  const [brandMenuVisible, setBrandMenuVisible] = useState(false);
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [nickname, setNickname] = useState('');
  const [plates, setPlates] = useState('');
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('0');
  const [hologram, setHologram] = useState<'0' | '00' | 'exento'>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!brand || !model || !year) { setError('Marca, modelo y año son requeridos.'); return; }
    setLoading(true);
    const { error } = await addCar({
      brand, model, year: parseInt(year), nickname: nickname || undefined,
      plates: plates || undefined, vin: vin || undefined,
      fuel_type: 'gasoline', current_mileage: parseInt(mileage) || 0,
      hologram_type: hologram, is_primary: false,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  };

  // Success state — operant reward
  if (done) {
    return (
      <View style={styles.success}>
        <Text style={{ fontSize: 72 }}>✅</Text>
        <Text style={[Typography.heading, { textAlign: 'center', marginTop: Spacing.lg }]}>
          Tu {brand} {model} está protegido.
        </Text>
        <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
          Bitácora ya está monitoreando tu auto.
        </Text>
        <Button mode="contained" style={styles.doneBtn} onPress={() => router.replace('/(tabs)')}>
          Ver mi auto
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[Typography.heading, { marginBottom: Spacing.lg }]}>Agregar auto</Text>

      {/* Brand picker */}
      <Menu visible={brandMenuVisible} onDismiss={() => setBrandMenuVisible(false)}
        anchor={
          <TextInput label="Marca *" value={brand} onFocus={() => setBrandMenuVisible(true)}
            right={<TextInput.Icon icon="chevron-down" />} style={styles.input} />
        }>
        {MX_BRANDS.map(b => (
          <Menu.Item key={b} title={b} onPress={() => { setBrand(b); setBrandMenuVisible(false); }} />
        ))}
      </Menu>

      <TextInput label="Modelo *" value={model} onChangeText={setModel} style={styles.input} />
      <TextInput label="Año *" value={year} onChangeText={setYear} keyboardType="numeric" style={styles.input} />
      <TextInput label="Apodo (ej. 'La Viejita')" value={nickname} onChangeText={setNickname} style={styles.input} />
      <TextInput label="Placas" value={plates} onChangeText={p => setPlates(p.toUpperCase())} autoCapitalize="characters" style={styles.input} />
      <TextInput label="VIN (opcional)" value={vin} onChangeText={setVin} style={styles.input} />
      <TextInput label="Kilometraje actual" value={mileage} onChangeText={setMileage} keyboardType="numeric" style={styles.input} />

      <Text style={[Typography.label, { marginBottom: Spacing.sm }]}>Tipo de holograma</Text>
      <SegmentedButtons value={hologram} onValueChange={v => setHologram(v as typeof hologram)}
        buttons={[
          { value: '0', label: 'Holograma 0' },
          { value: '00', label: 'Holograma 00' },
          { value: 'exento', label: 'Exento' },
        ]} style={{ marginBottom: Spacing.lg }} />

      <View style={styles.holoHelper}>
        <Text style={Typography.caption}>
          ¿No sabes tu holograma? Está en el engomado de verificación de tu parabrisas. Holograma 0 = verificas cada 6 meses. Holograma 00 = cada año. Exento = sin verificación.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleSubmit} loading={loading} style={styles.btn}>
        Guardar auto
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl },
  input: { marginBottom: Spacing.sm },
  holoHelper: { backgroundColor: Colors.background, borderRadius: 8, padding: Spacing.sm, marginBottom: Spacing.lg },
  btn: { borderRadius: 50, marginTop: Spacing.sm },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
  success: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface },
  doneBtn: { borderRadius: 50, marginTop: Spacing.xl, width: '100%' },
});

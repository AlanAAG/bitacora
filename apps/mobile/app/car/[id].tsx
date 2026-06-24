import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card, ActivityIndicator, Portal, Dialog, TextInput, SegmentedButtons, Checkbox } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useCars } from '../../hooks/useCars';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

type Holo = '00' | '0' | '1' | '2' | 'exento';

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cars, loading, updateCar } = useCars();
  const car = cars.find(c => c.id === id);

  const [edit, setEdit] = useState(false);
  const [mileage, setMileage] = useState('');
  const [plates, setPlates] = useState('');
  const [holo, setHolo] = useState<Holo>('0');
  const [electric, setElectric] = useState(false);
  const [moto, setMoto] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;
  if (!car) return (
    <View style={styles.container}>
      <Text style={Typography.body}>Auto no encontrado.</Text>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>
    </View>
  );

  const openEdit = () => {
    setMileage(String(car.current_mileage));
    setPlates(car.plates ?? '');
    setHolo(((car.hologram_type === 'doble_cero' ? '00' : car.hologram_type) ?? '0') as Holo);
    setElectric(!!car.is_electric_hybrid);
    setMoto(!!car.is_moto);
    setEdit(true);
  };

  const save = async () => {
    setSaving(true);
    await updateCar(car.id, {
      current_mileage: parseInt(mileage) || car.current_mileage,
      plates: plates || undefined,
      hologram_type: holo,
      is_electric_hybrid: electric,
      is_moto: moto,
    });
    setSaving(false);
    setEdit(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, { marginBottom: Spacing.md }]}>{car.display_name}</Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={Typography.label}>{car.year} · {car.plates ?? 'Sin placas'}</Text>
          <Text style={Typography.caption}>{car.current_mileage.toLocaleString('es-MX')} km · Holograma {car.hologram_type ?? '—'} · Salud {car.health_score}/100</Text>
        </Card.Content>
      </Card>

      <Button mode="contained" icon="pencil" style={styles.btn} onPress={openEdit}>
        Actualizar km / datos
      </Button>
      <Button mode="outlined" icon="wrench" style={styles.btn}
        onPress={() => router.push({ pathname: '/log/add', params: { carId: car.id } })}>
        Registrar servicio
      </Button>
      <Button mode="outlined" icon="camera" style={styles.btn}
        onPress={() => router.push({ pathname: '/ocr', params: { carId: car.id } })}>
        Importar bitácora (foto)
      </Button>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>

      <Portal>
        <Dialog visible={edit} onDismiss={() => setEdit(false)}>
          <Dialog.Title>Actualizar datos</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Kilometraje actual" value={mileage} onChangeText={setMileage}
              keyboardType="numeric" style={styles.input} />
            <TextInput label="Placas" value={plates} onChangeText={p => setPlates(p.toUpperCase())}
              autoCapitalize="characters" style={styles.input} />
            <Text style={[Typography.caption, { marginBottom: Spacing.xs }]}>Holograma</Text>
            <SegmentedButtons value={holo} onValueChange={v => setHolo(v as Holo)}
              buttons={[
                { value: '00', label: '00' }, { value: '0', label: '0' },
                { value: '1', label: '1' }, { value: '2', label: '2' }, { value: 'exento', label: 'Ex.' },
              ]} style={styles.input} />
            <Checkbox.Item label="Eléctrico/híbrido" status={electric ? 'checked' : 'unchecked'} onPress={() => setElectric(v => !v)} />
            <Checkbox.Item label="Motocicleta" status={moto ? 'checked' : 'unchecked'} onPress={() => setMoto(v => !v)} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEdit(false)}>Cancelar</Button>
            <Button onPress={save} loading={saving}>Guardar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.xl, paddingTop: 60 },
  card: { borderRadius: 12, marginBottom: Spacing.lg },
  btn: { borderRadius: 50, marginBottom: Spacing.sm },
  input: { marginBottom: Spacing.sm },
});

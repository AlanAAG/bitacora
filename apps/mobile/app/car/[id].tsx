import { View, StyleSheet } from 'react-native';
import { Text, Button, Card, ActivityIndicator } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useCars } from '../../hooks/useCars';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cars, loading } = useCars();
  const car = cars.find(c => c.id === id);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;
  if (!car) return (
    <View style={styles.container}>
      <Text style={Typography.body}>Auto no encontrado.</Text>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, { marginBottom: Spacing.md }]}>{car.display_name}</Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={Typography.label}>{car.year} · {car.plates ?? 'Sin placas'}</Text>
          <Text style={Typography.caption}>{car.current_mileage.toLocaleString('es-MX')} km · Salud {car.health_score}/100</Text>
        </Card.Content>
      </Card>

      <Button mode="contained" icon="wrench" style={styles.btn}
        onPress={() => router.push({ pathname: '/log/add', params: { carId: car.id } })}>
        Registrar servicio
      </Button>
      <Button mode="outlined" icon="camera" style={styles.btn}
        onPress={() => router.push({ pathname: '/ocr', params: { carId: car.id } })}>
        Importar bitácora (foto)
      </Button>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.xl, paddingTop: 60 },
  card: { borderRadius: 12, marginBottom: Spacing.lg },
  btn: { borderRadius: 50, marginBottom: Spacing.sm },
});

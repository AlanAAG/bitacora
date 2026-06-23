import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { Car } from '../types';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

const healthColor = (s: number) => s >= 80 ? Colors.accent : s >= 50 ? Colors.warning : Colors.danger;
const healthLabel = (s: number) => s >= 80 ? 'Excelente' : s >= 50 ? 'Regular' : 'Atención';

export function CarCard({ car }: { car: Car }) {
  const color = healthColor(car.health_score);
  return (
    <TouchableOpacity onPress={() => router.push(`/car/${car.id}`)} activeOpacity={0.8}>
      <View style={styles.card}>
        <View style={styles.left}>
          <Text style={[Typography.title, { marginBottom: 2 }]}>{car.display_name || `${car.brand} ${car.model}`}</Text>
          <Text style={Typography.label}>
            {car.year} · {car.plates ?? 'Sin placas'} · {car.current_mileage.toLocaleString('es-MX')} km
          </Text>
        </View>
        <View style={[styles.badge, { borderColor: color }]}>
          <Text style={[Typography.title, { color, lineHeight: 22 }]}>{car.health_score}</Text>
          <Text style={[Typography.caption, { color }]}>{healthLabel(car.health_score)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  left: { flex: 1, marginRight: Spacing.md },
  badge: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});

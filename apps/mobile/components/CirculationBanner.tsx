import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Car } from '../types';
import { canCirculateToday, plateLastDigit, Hologram } from '../lib/hoyNoCircula';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

export function CirculationBanner({ car, contingenciaPhase }: { car: Car; contingenciaPhase: 0 | 1 | 2 }) {
  const digit = plateLastDigit(car.plates);
  if (digit === null) return null;

  const holo = (car.hologram_type === 'doble_cero' ? '00' : car.hologram_type ?? '0') as Hologram;
  const { restricted, reason } = canCirculateToday({
    plateLastDigit: digit,
    hologram: holo,
    isElectricHybrid: car.is_electric_hybrid,
    isMoto: car.is_moto,
    date: new Date(),
    contingenciaPhase,
  });
  const color = restricted ? Colors.danger : Colors.accent;

  return (
    <View style={[styles.banner, { borderLeftColor: color }]}>
      <Text style={[Typography.label, { color, fontWeight: '700' }]}>
        {restricted ? '🚫 Hoy no circula' : '✓ Hoy circulas'} · {car.display_name}
      </Text>
      <Text style={Typography.caption}>{reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.card, borderLeftWidth: 4, borderRadius: 10,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: Spacing.sm, elevation: 1,
  },
});

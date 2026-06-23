import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { ServiceType } from '../types';
import { Colors } from '../constants/colors';

export const SERVICE_LABELS: Record<ServiceType, string> = {
  oil_change: 'Aceite', tire_rotation: 'Llantas', brake_service: 'Frenos',
  transmission: 'Transmisión', air_filter: 'Filtro aire', spark_plugs: 'Bujías',
  coolant: 'Anticongelante', battery: 'Batería', alignment: 'Alineación',
  inspection: 'Revisión', other: 'Otro',
};

export function ServiceChip({ type, selected, onPress }: { type: ServiceType; selected: boolean; onPress?: () => void }) {
  return (
    <Chip selected={selected} onPress={onPress} compact
      selectedColor={Colors.primary}
      style={[styles.chip, selected && styles.selected]}>
      {SERVICE_LABELS[type]}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: { margin: 4 },
  selected: { backgroundColor: '#EFF6FF' },
});

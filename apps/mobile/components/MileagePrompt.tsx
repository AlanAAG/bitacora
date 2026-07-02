import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, TextInput, Button } from 'react-native-paper';
import { Car } from '../types';
import { useCars } from '../hooks/useCars';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

// Mileage drives every reminder; she won't remember to update it, so nudge gently when stale.
export function MileagePrompt({ car, onSaved }: { car: Car; onSaved?: () => void }) {
  const { updateMileage } = useCars();
  const [km, setKm] = useState('');
  const [done, setDone] = useState(false);

  if (done) return null;

  const save = async () => {
    const n = parseInt(km);
    if (!n) return;
    await updateMileage(car.id, n);
    setDone(true);
    onSaved?.();
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={Typography.label}>¿Cuántos km marca hoy tu {car.display_name}?</Text>
        <Text style={Typography.caption}>Mantenerlo al día hace que los avisos sean exactos.</Text>
        <View style={styles.row}>
          <TextInput dense mode="outlined" keyboardType="numeric" value={km} onChangeText={setKm}
            placeholder={car.current_mileage.toLocaleString('es-MX')} style={{ flex: 1 }} />
          <Button mode="contained" onPress={save} style={{ marginLeft: Spacing.sm }}>Guardar</Button>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: 14, backgroundColor: '#EFF6FF' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
});

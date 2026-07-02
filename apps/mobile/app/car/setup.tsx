import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text, Button, SegmentedButtons } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useServiceLog } from '../../hooks/useServiceLog';
import { ServiceType } from '../../types';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

type Ago = 'lt3' | '3to6' | 'gt6' | 'unknown';

// Seed the schedule from a few rough answers so Home shows a real plan on first open —
// no need for a clean bitácora. "No sé" leaves it as due.
const SERVICES: { type: ServiceType; label: string }[] = [
  { type: 'oil_change', label: 'Cambio de aceite' },
  { type: 'brake_service', label: 'Balatas / frenos' },
  { type: 'tire_rotation', label: 'Llantas (rotación)' },
];
const MONTHS_AGO: Record<Ago, number | null> = { lt3: 1.5, '3to6': 4.5, gt6: 9, unknown: null };

export default function CarSetupScreen() {
  const { carId, mileage } = useLocalSearchParams<{ carId: string; mileage: string }>();
  const { addRecord } = useServiceLog(carId);
  const [ans, setAns] = useState<Record<string, Ago>>({});
  const [saving, setSaving] = useState(false);
  const currentMileage = parseInt(mileage ?? '0') || 0;

  const finish = async () => {
    setSaving(true);
    for (const s of SERVICES) {
      const a = ans[s.type];
      const months = a ? MONTHS_AGO[a] : null;
      if (months == null) continue; // unanswered or "no sé" → stays due
      const d = new Date();
      d.setMonth(d.getMonth() - Math.round(months));
      const km = Math.max(0, currentMileage - Math.round(months * 1000));
      await addRecord({
        car_id: carId!,
        service_date: d.toISOString().split('T')[0],
        mileage_at_service: km,
        services: [s.type],
        parts_replaced: [],
        imported_via_ocr: false,
      });
    }
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[Typography.heading, { marginBottom: Spacing.sm }]}>Una última cosa</Text>
      <Text style={[Typography.body, styles.sub]}>
        Para decirte qué necesita tu auto, ¿cuándo fue la última vez de cada cosa? Si no sabes, no hay problema —
        toca “No sé”.
      </Text>

      {SERVICES.map(s => (
        <View key={s.type} style={styles.block}>
          <Text style={[Typography.label, { marginBottom: Spacing.xs }]}>{s.label}</Text>
          <SegmentedButtons
            value={ans[s.type] ?? ''}
            onValueChange={v => setAns(p => ({ ...p, [s.type]: v as Ago }))}
            buttons={[
              { value: 'lt3', label: '<3 meses' },
              { value: '3to6', label: '3–6' },
              { value: 'gt6', label: '+6' },
              { value: 'unknown', label: 'No sé' },
            ]}
          />
        </View>
      ))}

      <Button mode="contained" loading={saving} onPress={finish} style={styles.btn}>
        Listo
      </Button>
      <Button mode="text" onPress={() => router.replace('/(tabs)')}>Omitir</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl },
  sub: { color: Colors.textSecondary, marginBottom: Spacing.lg },
  block: { marginBottom: Spacing.lg },
  btn: { borderRadius: 50, marginTop: Spacing.sm },
});

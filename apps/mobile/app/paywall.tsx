import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Copy } from '../constants/copy';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

// ponytail: no Stripe in MVP. The trial is granted server-side by the start-trial edge
// function (clients can't write subscriptions). Replace with RevenueCat for real billing.
async function activateTrial(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('start-trial');
  if (error) return 'No se pudo activar la prueba. Intenta de nuevo.';
  if (data?.error === 'already_subscribed') return 'Ya tienes una suscripción activa.';
  return null;
}

export default function PaywallScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onTrial = async () => {
    setBusy(true); setError('');
    const msg = await activateTrial();
    setBusy(false);
    if (msg) { setError(msg); return; }
    router.replace('/(tabs)');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[Typography.hero, styles.headline]}>{Copy.paywallHeadline}</Text>
      <Text style={[Typography.body, styles.sub]}>{Copy.paywallSub}</Text>

      {/* Math box */}
      <Card style={styles.mathCard}>
        <Card.Content>
          <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
            El cálculo
          </Text>
          {[
            { label: 'Multa por verificación vencida', value: '$3,000–$5,000 MXN' },
            { label: 'Sobrecobro promedio por visita', value: '$1,200 MXN' },
            { label: 'Seguro vencido (multa)', value: '$2,000 MXN' },
            { label: 'Bitácora Pro + Guardia / año', value: '$1,788 MXN' },
          ].map(r => (
            <View key={r.label} style={styles.row}>
              <Text style={Typography.body}>{r.label}</Text>
              <Text style={[Typography.label, { color: Colors.textPrimary }]}>{r.value}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[Typography.label, { color: Colors.accent }]}>ROI potencial en 1 incidente</Text>
            <Text style={[Typography.title, { color: Colors.accent }]}>47x</Text>
          </View>
        </Card.Content>
      </Card>

      <Text style={[Typography.body, styles.cta]}>{Copy.paywallMath}</Text>

      {/* Plans */}
      <Card style={styles.planCard}>
        <Card.Content>
          <Text style={[Typography.title, { marginBottom: Spacing.xs }]}>Pro + Guardia</Text>
          <Text style={[Typography.hero, { color: Colors.primary }]}>$149 <Text style={Typography.body}>MXN/mes</Text></Text>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
            Menos que un tanque de gasolina al mes
          </Text>
          {['Historial ilimitado', 'Modo Guardia ilimitado', 'Recordatorios inteligentes', 'Bóveda de documentos', 'Verificación vehicular automática'].map(f => (
            <Text key={f} style={[Typography.body, { marginBottom: 4 }]}>✓ {f}</Text>
          ))}
          <Button mode="contained" style={styles.activateBtn} loading={busy} onPress={onTrial}>
            Probar 7 días gratis
          </Button>
          {error ? <Text style={{ color: Colors.danger, marginTop: Spacing.sm }}>{error}</Text> : null}
        </Card.Content>
      </Card>

      <Button mode="text" onPress={() => router.back()}>
        {Copy.paywallFreeCta}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl },
  headline: { marginBottom: Spacing.sm },
  sub: { color: Colors.textSecondary, marginBottom: Spacing.lg },
  mathCard: { marginBottom: Spacing.lg, borderRadius: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  totalRow: { borderBottomWidth: 0, marginTop: Spacing.sm, paddingTop: Spacing.sm },
  cta: { textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.xl },
  planCard: { marginBottom: Spacing.md, borderRadius: 16, borderWidth: 2, borderColor: Colors.primary },
  activateBtn: { borderRadius: 50, marginTop: Spacing.lg },
});

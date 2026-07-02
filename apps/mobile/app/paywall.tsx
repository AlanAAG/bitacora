import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Copy } from '../constants/copy';
import { router } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { getMonthlyPackage, purchasePackage, purchasesAvailable, restorePurchases } from '../lib/purchases';

// Billing runs through the store (RevenueCat): purchase here → RevenueCat webhook →
// revenuecat-webhook edge function writes the subscriptions row (clients can't).
// The webhook lags the purchase by a few seconds; poll briefly so the UI catches up.
async function waitForSubscription(tries = 5): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  for (let i = 0; i < tries && user; i++) {
    const { data } = await supabase.from('subscriptions')
      .select('plan').eq('user_id', user.id).maybeSingle();
    if (data?.plan === 'pro_guard') return;
    await new Promise(r => setTimeout(r, 1500));
  }
}

export default function PaywallScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // ponytail: store-review kill-switch — CTA hidden until app_config.paywall.enabled.
  const [paywallEnabled, setPaywallEnabled] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    supabase.from('app_config').select('value').eq('key', 'paywall').maybeSingle()
      .then(({ data }) => setPaywallEnabled(data?.value?.enabled === true));
  }, []);

  useEffect(() => {
    if (paywallEnabled && purchasesAvailable()) getMonthlyPackage().then(setPkg);
  }, [paywallEnabled]);

  const onBuy = async () => {
    if (!pkg) return;
    setBusy(true); setError('');
    const result = await purchasePackage(pkg);
    if (result.ok) await waitForSubscription();
    setBusy(false);
    if (result.ok) { router.replace('/(tabs)'); return; }
    if (!result.cancelled) setError('No se pudo completar la compra. Intenta de nuevo.');
  };

  const onRestore = async () => {
    setBusy(true); setError('');
    const restored = await restorePurchases();
    if (restored) await waitForSubscription();
    setBusy(false);
    if (restored) { router.replace('/(tabs)'); return; }
    setError('No encontramos compras anteriores con esta cuenta.');
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
          {paywallEnabled && pkg ? (
            <>
              <Button mode="contained" style={styles.activateBtn} loading={busy} onPress={onBuy}>
                Probar 7 días gratis
              </Button>
              <Text style={[Typography.caption, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
                Después {pkg.product.priceString}/mes · cancela cuando quieras
              </Text>
            </>
          ) : (
            <Text style={[Typography.label, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.lg }]}>
              Disponible pronto
            </Text>
          )}
          {error ? <Text style={{ color: Colors.danger, marginTop: Spacing.sm }}>{error}</Text> : null}
        </Card.Content>
      </Card>

      {paywallEnabled && pkg ? (
        <Button mode="text" disabled={busy} onPress={onRestore}>
          Restaurar compras
        </Button>
      ) : null}
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

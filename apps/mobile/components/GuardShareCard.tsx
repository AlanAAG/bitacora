import { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

interface Props {
  trustLevel: 'green' | 'yellow' | 'red';
  trustScore: number;
  shopName?: string;
  estimatedSavings?: number;
  date: string;
}

const LEVEL_EMOJI = { green: '🟢', yellow: '🟡', red: '🔴' };
const LEVEL_TEXT = { green: 'Mecánico honesto', yellow: 'Revisar detalles', red: 'Alerta de cobro' };
const LEVEL_COLOR = { green: Colors.accent, yellow: Colors.warning, red: Colors.danger };

export const GuardShareCard = forwardRef<View, Props>(function GuardShareCard(
  { trustLevel, trustScore, shopName, estimatedSavings, date },
  ref
) {
  return (
    <View ref={ref} style={styles.card}>
      <Text style={styles.appName}>🛡 Bitácora</Text>
      <Text style={styles.emoji}>{LEVEL_EMOJI[trustLevel]}</Text>
      <Text style={[styles.verdict, { color: LEVEL_COLOR[trustLevel] }]}>
        {LEVEL_TEXT[trustLevel]}
      </Text>
      {shopName && <Text style={styles.shop}>{shopName} · {date}</Text>}
      <Text style={styles.score}>Puntaje: {trustScore}/100</Text>
      {estimatedSavings !== undefined && estimatedSavings > 0 && (
        <Text style={styles.savings}>Ahorro estimado: ${estimatedSavings.toLocaleString('es-MX')} MXN</Text>
      )}
      <Text style={styles.cta}>bitacora.app — Protege tu auto y tu dinero</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: 360, padding: Spacing.xl, backgroundColor: '#0F172A', alignItems: 'center', borderRadius: 20 },
  appName: { color: '#94A3B8', fontSize: 14, marginBottom: Spacing.lg },
  emoji: { fontSize: 48, marginBottom: Spacing.sm },
  verdict: { fontSize: 24, fontWeight: '800', marginBottom: Spacing.xs },
  shop: { color: '#94A3B8', fontSize: 13, marginBottom: Spacing.sm },
  score: { color: '#E2E8F0', fontSize: 14, marginBottom: Spacing.sm },
  savings: { color: Colors.warning, fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm },
  cta: { color: '#475569', fontSize: 12, marginTop: Spacing.md },
});

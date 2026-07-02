import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Chip } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { GuardFlag } from '../types';
import { Copy } from '../constants/copy';

const TRUST_CONFIG = {
  green: { color: Colors.accent, label: Copy.guardResultHonest, bg: '#F0FDF4' },
  yellow: { color: Colors.warning, label: Copy.guardResultWarning, bg: '#FFFBEB' },
  red: { color: Colors.danger, label: Copy.guardResultDanger, bg: '#FEF2F2' },
};

const FLAG_LABELS: Record<string, string> = {
  overcharge: 'Cobro excesivo',
  unnecessary_service: 'Servicio innecesario',
  premature_replacement: 'Reemplazo prematuro',
  inconsistent_diagnosis: 'Diagnóstico inconsistente',
};

const SEVERITY_COLOR: Record<string, string> = {
  high: Colors.danger, medium: Colors.warning, low: Colors.textSecondary,
};

interface Props {
  trustScore: number;
  trustLevel: 'green' | 'yellow' | 'red';
  summary: string;
  flags: GuardFlag[];
  estimatedSavings?: number;
  onShare: () => void;
  onNewSession: () => void;
}

export function GuardResultCard({ trustScore, trustLevel, summary, flags, estimatedSavings, onShare, onNewSession }: Props) {
  const config = TRUST_CONFIG[trustLevel];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Score ring */}
      <View style={[styles.scoreRing, { borderColor: config.color, backgroundColor: config.bg }]}>
        <Text style={[Typography.hero, { color: config.color }]}>{trustScore}</Text>
        <Text style={[Typography.caption, { color: config.color }]}>/100</Text>
      </View>

      <Text style={[Typography.heading, { textAlign: 'center', color: config.color, marginBottom: Spacing.sm }]}>
        {config.label}
      </Text>

      <Text style={[Typography.body, styles.summary]}>{summary}</Text>

      {/* Savings callout */}
      {estimatedSavings !== undefined && estimatedSavings > 0 && (
        <View style={styles.savingsBox}>
          <Text style={styles.savingsLabel}>{Copy.guardSavedPrefix}</Text>
          <Text style={styles.savingsAmount}>${estimatedSavings.toLocaleString('es-MX')} MXN</Text>
        </View>
      )}
      {estimatedSavings === 0 && trustLevel === 'green' && (
        <View style={[styles.savingsBox, { backgroundColor: '#F0FDF4', borderColor: Colors.accent }]}>
          <Text style={[styles.savingsLabel, { color: Colors.accent }]}>
            Los precios del mecánico están dentro del rango de mercado. No detectamos sobrecobros.
          </Text>
        </View>
      )}

      {/* Flags */}
      {flags.length > 0 && (
        <View style={styles.flagsSection}>
          <Text style={[Typography.label, { marginBottom: Spacing.sm }]}>
            Alertas detectadas ({flags.length})
          </Text>
          {flags.map((flag, i) => (
            <View key={i} style={[styles.flagCard, { borderLeftColor: SEVERITY_COLOR[flag.severity] }]}>
              <Chip compact selectedColor={SEVERITY_COLOR[flag.severity]}
                style={styles.flagChip}>
                {FLAG_LABELS[flag.type] ?? flag.type}
              </Chip>
              <Text style={[Typography.body, { marginTop: Spacing.sm }]}>{flag.description}</Text>
              {flag.mechanic_quote && (
                <Text style={styles.quote}>“{flag.mechanic_quote}”</Text>
              )}
              {flag.reference_data && (
                <Text style={styles.ref}>Referencia: {flag.reference_data}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <Button mode="contained" icon="share-variant" onPress={onShare} style={styles.shareBtn}>
        {Copy.guardShareCta}
      </Button>
      <Button mode="outlined" onPress={onNewSession} style={styles.newBtn}>
        {Copy.guardNewSession}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl, alignItems: 'center' },
  scoreRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  summary: { textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.lg },
  savingsBox: { backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: Colors.warning, borderRadius: 12, padding: Spacing.md, width: '100%', marginBottom: Spacing.lg, alignItems: 'center' },
  savingsLabel: { ...Typography.label, color: Colors.warning, textAlign: 'center' },
  savingsAmount: { fontSize: 28, fontWeight: '800', color: Colors.warning, marginTop: 4 },
  flagsSection: { width: '100%', marginBottom: Spacing.lg },
  flagCard: { borderLeftWidth: 4, backgroundColor: Colors.background, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.sm },
  flagChip: { alignSelf: 'flex-start', marginBottom: Spacing.xs },
  quote: { ...Typography.caption, fontStyle: 'italic', color: Colors.textSecondary, marginTop: Spacing.xs },
  ref: { ...Typography.caption, color: Colors.primary, marginTop: Spacing.xs },
  shareBtn: { borderRadius: 50, width: '100%', marginBottom: Spacing.sm },
  newBtn: { borderRadius: 50, width: '100%' },
});

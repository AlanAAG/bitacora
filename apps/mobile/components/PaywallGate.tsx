import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Copy } from '../constants/copy';
import { useSubscription } from '../hooks/useSubscription';

interface Props {
  feature: 'guard' | 'pro';
  children: React.ReactNode;
}

export function PaywallGate({ feature, children }: Props) {
  const { canUseGuard, freeGuardLeft, hasGuard } = useSubscription();

  if (feature === 'guard' && !canUseGuard) {
    return (
      <View style={styles.wall}>
        <Text style={styles.icon}>🛡</Text>
        <Text style={[Typography.title, { textAlign: 'center' }]}>{Copy.paywallHeadline}</Text>
        <Text style={[Typography.body, styles.sub]}>{Copy.paywallSub}</Text>
        <View style={styles.mathBox}>
          <Text style={[Typography.label, { color: Colors.accent }]}>{Copy.paywallMath}</Text>
        </View>
        <Button mode="contained" style={styles.cta} onPress={() => router.push('/paywall')}>
          {Copy.paywallCta}
        </Button>
      </View>
    );
  }

  // Show free session counter if applicable
  if (feature === 'guard' && freeGuardLeft > 0 && !hasGuard) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.freeBanner}>
          <Text style={[Typography.caption, { color: Colors.warning }]}>
            {freeGuardLeft} sesión{freeGuardLeft !== 1 ? 'es' : ''} gratis restante{freeGuardLeft !== 1 ? 's' : ''}
          </Text>
        </View>
        {children}
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  wall: { flex: 1, padding: Spacing.xl, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  icon: { fontSize: 64, marginBottom: Spacing.lg },
  sub: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  mathBox: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.xl, borderLeftWidth: 4, borderLeftColor: Colors.accent },
  cta: { borderRadius: 50, width: '100%' },
  freeBanner: { backgroundColor: '#FEF9C3', padding: Spacing.sm, alignItems: 'center' },
});

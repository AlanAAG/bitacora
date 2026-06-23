import { View, StyleSheet, Share } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { router } from 'expo-router';
import { useReferral } from '../hooks/useReferral';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Copy } from '../constants/copy';

export default function ReferralScreen() {
  const { code, referralCount, shareText } = useReferral();
  const sessionsEarned = referralCount * 5;

  const onShare = async () => {
    if (!shareText) return;
    await Share.share({ message: shareText });
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.headline]}>{Copy.referralHeadline}</Text>
      <Text style={[Typography.body, styles.body]}>{Copy.referralBody}</Text>

      <Card style={styles.codeCard}>
        <Card.Content style={{ alignItems: 'center' }}>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>Tu código</Text>
          <Text style={[Typography.hero, { color: Colors.primary, letterSpacing: 4 }]}>{code ?? '...'}</Text>
        </Card.Content>
      </Card>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[Typography.hero, { color: Colors.textPrimary }]}>{referralCount}</Text>
          <Text style={Typography.caption}>Invitados</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[Typography.hero, { color: Colors.accent }]}>{sessionsEarned}</Text>
          <Text style={Typography.caption}>Sesiones ganadas</Text>
        </View>
      </View>

      <Button mode="contained" icon="share-variant" onPress={onShare} style={styles.shareBtn} disabled={!code}>
        Compartir mi link
      </Button>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.xl, justifyContent: 'center' },
  headline: { marginBottom: Spacing.sm },
  body: { color: Colors.textSecondary, marginBottom: Spacing.lg },
  codeCard: { borderRadius: 16, marginBottom: Spacing.lg, borderWidth: 2, borderColor: Colors.primary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.xl },
  stat: { alignItems: 'center' },
  shareBtn: { borderRadius: 50, marginBottom: Spacing.sm },
});

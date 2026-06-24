import { useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { useCars } from '../../hooks/useCars';
import { useGuard } from '../../hooks/useGuard';
import { EmptyState } from '../../components/EmptyState';
import { GuardSession } from '../../types';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

const LEVEL = {
  green: { color: Colors.accent, label: 'Honesto' },
  yellow: { color: Colors.warning, label: 'Revisar' },
  red: { color: Colors.danger, label: 'Alerta' },
} as const;

export default function GuardHistoryScreen() {
  const { cars } = useCars();
  const primary = cars[0];
  const { sessions, fetchSessions } = useGuard(primary?.id);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const completed = sessions.filter((s: GuardSession) => s.status === 'complete');

  if (!primary) return <EmptyState icon="🛡" title="Sin auto registrado" body="Agrega un auto primero." quote={null} />;

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Historial de Guardia</Text>
      <FlatList
        data={completed}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const cfg = LEVEL[item.trust_level ?? 'green'];
          return (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.row}>
                  <Text style={[Typography.label, { color: cfg.color, fontWeight: '700' }]}>
                    {cfg.label} · {item.trust_score ?? '—'}/100
                  </Text>
                  <Text style={Typography.caption}>
                    {item.started_at ? new Date(item.started_at).toLocaleDateString('es-MX') : ''}
                  </Text>
                </View>
                {item.shop_name ? <Text style={Typography.caption}>{item.shop_name}</Text> : null}
                {item.summary ? <Text style={[Typography.caption, { marginTop: 4 }]}>{item.summary}</Text> : null}
                {item.estimated_savings_mxn ? (
                  <Text style={[Typography.caption, { color: Colors.warning, marginTop: 4 }]}>
                    Ahorro estimado: ${item.estimated_savings_mxn.toLocaleString('es-MX')} MXN
                  </Text>
                ) : null}
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="🗂" title="Sin sesiones aún" body="Tus análisis de Modo Guardia aparecerán aquí." quote={null} />
        }
      />
      <Button mode="text" onPress={() => router.back()} style={{ margin: Spacing.md }}>Volver</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 20 },
  card: { marginBottom: Spacing.sm, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});

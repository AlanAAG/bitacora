import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, FAB, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { useCars } from '../../hooks/useCars';
import { useServiceLog } from '../../hooks/useServiceLog';
import { SERVICE_LABELS } from '../../components/ServiceChip';
import { EmptyState } from '../../components/EmptyState';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

// ponytail: single-car view (primary car). Multi-car switcher when users actually have 2+.
export default function ServiceLogScreen() {
  const { cars } = useCars();
  const primary = cars[0];
  const { records, loading } = useServiceLog(primary?.id);

  if (!primary) return <EmptyState icon="🧾" title="Sin auto registrado" body="Agrega un auto primero." quote={null} />;
  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Servicios — {primary.display_name}</Text>
      <FlatList
        data={records}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text style={Typography.label}>{item.service_date}</Text>
                <Text style={Typography.caption}>{item.mileage_at_service.toLocaleString('es-MX')} km</Text>
              </View>
              <Text style={[Typography.caption, { marginTop: 4 }]}>
                {item.services.map(s => SERVICE_LABELS[s]).join(' · ')}
              </Text>
              {item.shop_name ? <Text style={Typography.caption}>{item.shop_name}</Text> : null}
              {item.total_cost_mxn != null ? (
                <Text style={[Typography.caption, { color: Colors.textPrimary, marginTop: 2 }]}>
                  ${item.total_cost_mxn.toLocaleString('es-MX')} MXN
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState icon="🧾" title="Sin servicios registrados"
            body="Registra el primer servicio de tu auto." quote={null} />
        }
      />
      <FAB icon="plus" style={styles.fab} color={Colors.surface} customSize={56}
        onPress={() => router.push({ pathname: '/log/add', params: { carId: primary.id } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  card: { marginBottom: Spacing.sm, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.md, backgroundColor: Colors.primary },
});

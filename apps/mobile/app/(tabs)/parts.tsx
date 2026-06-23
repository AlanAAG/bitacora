import { View, FlatList, StyleSheet } from 'react-native';
import { Text, ProgressBar, Card } from 'react-native-paper';
import { useParts } from '../../hooks/useParts';
import { useCars } from '../../hooks/useCars';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { EmptyState } from '../../components/EmptyState';
import { Part } from '../../types';

function PartRow({ part, currentMileage }: { part: Part; currentMileage: number }) {
  const pct = part.expected_lifetime_km
    ? Math.min(1, (currentMileage - part.installed_mileage) / part.expected_lifetime_km)
    : 0;
  const color = pct < 0.7 ? Colors.accent : pct < 0.9 ? Colors.warning : Colors.danger;
  const kmLeft = part.expected_lifetime_km
    ? Math.max(0, part.installed_mileage + part.expected_lifetime_km - currentMileage)
    : null;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.partHeader}>
          <Text style={Typography.label}>{part.part_name}</Text>
          {kmLeft !== null && (
            <Text style={[Typography.caption, { color }]}>
              {kmLeft > 0 ? `${kmLeft.toLocaleString('es-MX')} km restantes` : 'Vencida'}
            </Text>
          )}
        </View>
        {part.expected_lifetime_km && (
          <ProgressBar progress={pct} color={color} style={styles.bar} />
        )}
        <Text style={Typography.caption}>
          Instalada: {part.installed_date} @ {part.installed_mileage.toLocaleString('es-MX')} km
        </Text>
      </Card.Content>
    </Card>
  );
}

export default function PartsScreen() {
  const { cars } = useCars();
  const primary = cars[0];
  const { parts } = useParts(primary?.id);

  if (!primary) return <EmptyState icon="🔧" title="Sin auto registrado" body="Agrega un auto primero." quote={null} />;

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Piezas — {primary.display_name}</Text>
      <FlatList
        data={parts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PartRow part={item} currentMileage={primary.current_mileage} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="⚙️" title="Sin piezas registradas"
            body="Agrega las piezas reemplazadas para saber cuándo toca el próximo cambio." quote={null} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 80 },
  card: { marginBottom: Spacing.sm, borderRadius: 12 },
  partHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  bar: { height: 6, borderRadius: 3, marginBottom: Spacing.xs },
});

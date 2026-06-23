import { View, FlatList, StyleSheet } from 'react-native';
import { FAB, Text, ActivityIndicator } from 'react-native-paper';
import { useCars } from '../../hooks/useCars';
import { useReminders } from '../../hooks/useReminders';
import { CarCard } from '../../components/CarCard';
import { ReminderBanner } from '../../components/ReminderBanner';
import { EmptyState } from '../../components/EmptyState';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

export default function HomeScreen() {
  const { cars, loading } = useCars();
  const { activeReminders } = useReminders(cars.map(c => c.id));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Mis autos</Text>
      {activeReminders.slice(0, 3).map(r => <ReminderBanner key={r.id} reminder={r} />)}
      <FlatList
        data={cars}
        keyExtractor={c => c.id}
        renderItem={({ item }) => <CarCard car={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="🚗"
            title="Sin autos registrados"
            body="Agrega tu primer auto y empieza a protegerlo."
            quote={null}
          />
        }
      />
      <FAB icon="plus" style={styles.fab} color={Colors.surface}
        customSize={56} onPress={() => router.push('/car/add')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.md, backgroundColor: Colors.primary },
});

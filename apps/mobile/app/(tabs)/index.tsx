import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { FAB, Text, ActivityIndicator } from 'react-native-paper';
import { useCars } from '../../hooks/useCars';
import { useReminders } from '../../hooks/useReminders';
import { CarCard } from '../../components/CarCard';
import { ReminderBanner } from '../../components/ReminderBanner';
import { CirculationBanner } from '../../components/CirculationBanner';
import { EmptyState } from '../../components/EmptyState';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

export default function HomeScreen() {
  const { cars, loading } = useCars();
  const { activeReminders } = useReminders(cars.map(c => c.id));
  const [contingencia, setContingencia] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    supabase.from('app_config').select('value').eq('key', 'contingencia').maybeSingle()
      .then(({ data }) => setContingencia((data?.value?.phase === 1 || data?.value?.phase === 2) ? data.value.phase : 0));
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;

  const primary = cars[0];

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Mis autos</Text>
      {primary && <CirculationBanner car={primary} contingenciaPhase={contingencia} />}
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

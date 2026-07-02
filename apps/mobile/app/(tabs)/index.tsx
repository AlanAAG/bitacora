import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { FAB, Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { useCars } from '../../hooks/useCars';
import { useReminders } from '../../hooks/useReminders';
import { CarCard } from '../../components/CarCard';
import { CirculationBanner } from '../../components/CirculationBanner';
import { NextActions } from '../../components/NextActions';
import { MileagePrompt } from '../../components/MileagePrompt';
import { EmptyState } from '../../components/EmptyState';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

export default function HomeScreen() {
  const { cars, loading, refetch } = useCars();
  const { activeReminders } = useReminders(cars.map(c => c.id));
  const [contingencia, setContingencia] = useState<0 | 1 | 2>(0);
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    supabase.from('app_config').select('value').eq('key', 'contingencia').maybeSingle()
      .then(({ data }) => setContingencia((data?.value?.phase === 1 || data?.value?.phase === 2) ? data.value.phase : 0));
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;

  const primary = cars[0];
  const mileageStale = primary && (loadedAt - new Date(primary.updated_at).getTime()) > 14 * 86400000;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[Typography.heading, styles.header]}>Mis autos</Text>
        <IconButton icon="cog" onPress={() => router.push('/settings/privacy')} />
      </View>
      {primary && <CirculationBanner car={primary} contingenciaPhase={contingencia} />}
      {primary && mileageStale && <MileagePrompt car={primary} onSaved={refetch} />}
      {primary && <NextActions car={primary} reminders={activeReminders.filter(r => r.car_id === primary.id)} />}
      {primary && (
        <Text style={styles.seeAll} onPress={() => router.push({ pathname: '/log/add', params: { carId: primary.id } })}>
          + Registré un servicio
        </Text>
      )}
      {activeReminders.length > 0 && (
        <Text style={styles.seeAll} onPress={() => router.push('/reminders')}>
          Ver todos los recordatorios →
        </Text>
      )}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: Spacing.sm },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  seeAll: { ...Typography.label, color: Colors.primary, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.md, backgroundColor: Colors.primary },
});

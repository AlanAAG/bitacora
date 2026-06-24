import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { useCars } from '../hooks/useCars';
import { useReminders } from '../hooks/useReminders';
import { ReminderBanner } from '../components/ReminderBanner';
import { EmptyState } from '../components/EmptyState';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

export default function RemindersScreen() {
  const { cars } = useCars();
  const { activeReminders } = useReminders(cars.map(c => c.id));

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Recordatorios</Text>
      <FlatList
        data={activeReminders}
        keyExtractor={r => r.id}
        renderItem={({ item }) => <ReminderBanner reminder={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="🔔" title="Sin recordatorios" body="Todo en orden. Te avisaremos cuando algo necesite tu atención." quote={null} />
        }
      />
      <Button mode="text" onPress={() => router.back()} style={{ margin: Spacing.md }}>Volver</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  list: { paddingTop: Spacing.sm, paddingBottom: 20 },
});

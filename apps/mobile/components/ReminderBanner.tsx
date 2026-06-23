import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../types';
import { useReminders } from '../hooks/useReminders';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

const SOURCE_COLOR: Record<string, string> = {
  part_tracker: Colors.warning,
  agent: Colors.primary,
  verification: '#7C3AED',
  manual: Colors.textSecondary,
};

export function ReminderBanner({ reminder }: { reminder: Reminder }) {
  const { dismissReminder } = useReminders([reminder.car_id]);
  const color = SOURCE_COLOR[reminder.source] ?? Colors.textSecondary;

  return (
    <View style={[styles.banner, { borderLeftColor: color }]}>
      <View style={styles.content}>
        <Text style={[Typography.label, { fontWeight: '600' }]}>{reminder.title}</Text>
        {reminder.description && <Text style={Typography.caption}>{reminder.description}</Text>}
      </View>
      <TouchableOpacity onPress={() => dismissReminder(reminder.id)} style={styles.dismiss}>
        <Ionicons name="close" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', backgroundColor: Colors.card, borderLeftWidth: 4, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: 10, paddingLeft: Spacing.sm, elevation: 1 },
  content: { flex: 1, paddingVertical: Spacing.sm },
  dismiss: { padding: Spacing.sm, justifyContent: 'center' },
});

import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { Car, Reminder } from '../types';
import { useServiceLog } from '../hooks/useServiceLog';
import { computeSchedule, scheduleSummary, ScheduleItem } from '../lib/maintenanceSchedule';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

type Row = { key: string; color: string; title: string; sub: string };

const STATUS_COLOR = { due: Colors.danger, soon: Colors.warning, ok: Colors.accent };

function maintRow(it: ScheduleItem): Row {
  return {
    key: `m-${it.type}`,
    color: STATUS_COLOR[it.status],
    title: it.label,
    sub: `${scheduleSummary(it)} · ~$${it.estCostMxn.toLocaleString('es-MX')} MXN`,
  };
}

// The single answer to "¿qué necesita mi auto y cuándo?" — maintenance schedule + compliance reminders.
export function NextActions({ car, reminders }: { car: Car; reminders: Reminder[] }) {
  const { records } = useServiceLog(car.id);
  const schedule = computeSchedule(
    records.map(r => ({ service_date: r.service_date, mileage_at_service: r.mileage_at_service, services: r.services })),
    car.current_mileage,
    new Date(),
    { updatedAt: car.updated_at },
  );

  const due = schedule.filter(s => s.status === 'due');
  const soon = schedule.filter(s => s.status === 'soon');
  const okCount = schedule.length - due.length - soon.length;

  const reminderRows: Row[] = reminders.map(r => ({
    key: `r-${r.id}`, color: Colors.primary, title: r.title, sub: r.description ?? '',
  }));

  const urgent: Row[] = [...due.map(maintRow), ...reminderRows];
  const upcoming: Row[] = soon.map(maintRow);
  const dueCost = due.reduce((t, it) => t + it.estCostMxn, 0);

  if (urgent.length === 0 && upcoming.length === 0) {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Text style={[Typography.title, { color: Colors.accent }]}>Todo en orden ✓</Text>
          <Text style={Typography.caption}>No hay nada pendiente para tu {car.display_name}.</Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={[Typography.title, { marginBottom: Spacing.sm }]}>Próximas acciones</Text>
        {urgent.map(row => <RowView key={row.key} row={row} />)}
        {upcoming.length > 0 && (
          <>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.xs }]}>
              Pronto
            </Text>
            {upcoming.map(row => <RowView key={row.key} row={row} />)}
          </>
        )}
        {dueCost > 0 && (
          <Text style={[Typography.caption, { marginTop: Spacing.sm, color: Colors.textSecondary }]}>
            Si lo atiendes todo ahora: ~${dueCost.toLocaleString('es-MX')} MXN
          </Text>
        )}
        {okCount > 0 && (
          <Text style={[Typography.caption, { color: Colors.textMuted }]}>
            {okCount} servicio{okCount !== 1 ? 's' : ''} al día ✓
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

function RowView({ row }: { row: Row }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: row.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={Typography.label}>{row.title}</Text>
        {row.sub ? <Text style={Typography.caption}>{row.sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.sm },
});

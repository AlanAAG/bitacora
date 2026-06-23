import { StyleSheet, Linking } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';

interface Props {
  message: string;
  isOverdue?: boolean;
  startDate?: string;
  endDate?: string;
}

export function VerificationAlert({ message, isOverdue, startDate, endDate }: Props) {
  const color = isOverdue ? '#ef4444' : '#f59e0b';
  return (
    <Card style={[styles.card, { borderLeftColor: color }]}>
      <Card.Content>
        <Text variant="labelMedium" style={styles.title}>Verificación Vehicular</Text>
        <Text variant="bodySmall" style={styles.msg}>{message}</Text>
        {startDate && endDate && (
          <Text variant="bodySmall" style={styles.dates}>
            Período: {startDate} al {endDate}
          </Text>
        )}
        <Button compact mode="text"
          onPress={() => Linking.openURL('https://www.sedema.cdmx.gob.mx')}>
          Ver verificentros →
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderLeftWidth: 4, marginBottom: 12 },
  title: { fontWeight: '600', marginBottom: 4 },
  msg: { color: '#444', marginBottom: 4 },
  dates: { color: '#888', marginBottom: 4 },
});

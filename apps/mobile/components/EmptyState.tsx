import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

// Social proof quotes shown in empty states to trigger vicarious learning (Bandura)
export const SOCIAL_QUOTES = [
  { text: '"La IA detectó que me querían cobrar $1,800 de más en la transmisión. Pagué $600."', author: 'Carlos M., CDMX' },
  { text: '"Finalmente tengo todo el historial de mi Jetta en un solo lugar."', author: 'Sofía R., Monterrey' },
  { text: '"Me avisó 3 semanas antes de que venciera mi seguro. Nunca lo hubiera recordado."', author: 'Miguel A., Guadalajara' },
];

interface Props {
  icon: string;
  title: string;
  body: string;
  quote?: { text: string; author: string } | null;
}

export function EmptyState({ icon, title, body, quote }: Props) {
  const [randomQuote] = useState(() => SOCIAL_QUOTES[Math.floor(Math.random() * SOCIAL_QUOTES.length)]);
  const q = quote ?? randomQuote;
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[Typography.title, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[Typography.body, styles.body]}>{body}</Text>
      {q && (
        <View style={styles.quote}>
          <Text style={[Typography.caption, { fontStyle: 'italic', color: Colors.textSecondary }]}>{q.text}</Text>
          <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 4 }]}>— {q.author}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.xxl, paddingHorizontal: Spacing.xl, alignItems: 'center' },
  icon: { fontSize: 56, marginBottom: Spacing.md },
  body: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  quote: { backgroundColor: Colors.background, borderRadius: 12, padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.border, alignSelf: 'stretch' },
});

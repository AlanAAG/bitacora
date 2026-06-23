import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const Typography = StyleSheet.create({
  hero:    { fontSize: 32, fontWeight: '800', lineHeight: 40,  color: Colors.textPrimary },
  heading: { fontSize: 24, fontWeight: '700', lineHeight: 32,  color: Colors.textPrimary },
  title:   { fontSize: 18, fontWeight: '600', lineHeight: 26,  color: Colors.textPrimary },
  body:    { fontSize: 15, fontWeight: '400', lineHeight: 22,  color: Colors.textPrimary },
  label:   { fontSize: 13, fontWeight: '500', lineHeight: 18,  color: Colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16,  color: Colors.textMuted },
});

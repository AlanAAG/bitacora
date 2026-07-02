export const Colors = {
  primary:    '#1A3A6B',  // Deep navy — trust, authority (think: insurance, banks)
  primaryLight: '#2856A8',
  accent:     '#22C55E',  // Green — safety, confirmed honest
  warning:    '#F59E0B',  // Amber — investigate
  danger:     '#EF4444',  // Red — alert, scam flag
  surface:    '#FFFFFF',
  background: '#F4F6FA',  // Soft blue-grey, not harsh white
  card:       '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted:  '#9CA3AF',
  border:     '#E5E7EB',
  // Guard Mode — full black
  guardBg:    '#000000',
  guardAccent:'#EF4444',  // red pulse = recording
  guardText:  '#FFFFFF',
} as const;

export type ColorKey = keyof typeof Colors;

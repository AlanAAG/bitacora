import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, StatusBar } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Copy } from '../constants/copy';

interface Props {
  onStop: () => void;
  shopName?: string;
}

export function GuardRecordingScreen({ onStop, shopName }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  // Red pulsing dot — the only visual while recording
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.guardBg} />
      <Animated.View style={[styles.dot, { transform: [{ scale: pulse }] }]} />
      <Text style={styles.status}>{Copy.guardRecording}</Text>
      <Text style={styles.sub}>{Copy.guardRecordingSub}</Text>
      {shopName && <Text style={styles.shop}>{shopName}</Text>}
      <Button mode="outlined" onPress={onStop} textColor={Colors.guardText} style={styles.stopBtn}>
        {Copy.guardStop}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.guardBg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: 40,
  },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.guardAccent,
    marginBottom: 32,
  },
  status: { ...Typography.title, color: Colors.guardText, textAlign: 'center' },
  sub: { ...Typography.body, color: '#9CA3AF', textAlign: 'center', marginTop: 12, marginBottom: 48 },
  shop: { ...Typography.label, color: '#6B7280', marginTop: -32, marginBottom: 48 },
  stopBtn: { borderColor: '#374151', borderRadius: 50, width: '100%' },
});

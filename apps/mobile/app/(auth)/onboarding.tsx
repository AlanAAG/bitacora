import { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Copy } from '../../constants/copy';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [painConfirmed, setPainConfirmed] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const goToStep = (n: number) => {
    Animated.timing(slideAnim, { toValue: -n * width, duration: 280, useNativeDriver: true }).start();
    setStep(n);
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.slides, { transform: [{ translateX: slideAnim }] }]}>

        {/* Step 0 — Pain activation */}
        <View style={[styles.slide, styles.slidePain]}>
          <Text style={[Typography.hero, styles.painQuestion]}>{Copy.ob1Question}</Text>
          <View style={styles.painButtons}>
            <Button mode="contained" style={styles.yesBtn} contentStyle={styles.bigBtn}
              onPress={() => { setPainConfirmed(true); goToStep(1); }}>
              {Copy.ob1Yes}
            </Button>
            <Button mode="outlined" style={styles.noBtn} contentStyle={styles.bigBtn}
              onPress={() => goToStep(1)}>
              {Copy.ob1No}
            </Button>
          </View>
        </View>

        {/* Step 1 — Solution reveal */}
        <View style={[styles.slide, styles.slideSolution]}>
          <Text style={[Typography.hero, { color: Colors.surface }]}>{Copy.ob2Headline}</Text>
          <Text style={[Typography.body, { color: '#CBD5E1', marginTop: Spacing.md }]}>
            {Copy.ob2Body}
          </Text>
          {painConfirmed && (
            <View style={styles.savingsBox}>
              <Text style={styles.savingsText}>
                El promedio de sobrecobro en talleres en México: $1,200 MXN por visita.
              </Text>
            </View>
          )}
          <Button mode="contained" style={styles.continueBtn} contentStyle={styles.bigBtn}
            buttonColor={Colors.accent} textColor="#000"
            onPress={() => goToStep(2)}>
            Ver cómo funciona →
          </Button>
        </View>

        {/* Step 2 — Feature overview + CTA to sign up */}
        <View style={[styles.slide, styles.slideFeatures]}>
          <Text style={[Typography.heading, { marginBottom: Spacing.lg }]}>Lo que Bitácora hace por ti</Text>
          {[
            { icon: '📋', title: 'Historial digital', sub: 'Todo el mantenimiento de tu auto en un lugar.' },
            { icon: '🔔', title: 'Recordatorios inteligentes', sub: 'Verificación, aceite, seguro — te avisamos antes.' },
            { icon: '🛡', title: 'Modo Guardia', sub: 'La IA escucha al mecánico y te alerta si algo no cuadra.' },
          ].map(f => (
            <View key={f.icon} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureTextWrap}>
                <Text style={[Typography.label, { color: Colors.textPrimary, fontWeight: '600' }]}>{f.title}</Text>
                <Text style={Typography.caption}>{f.sub}</Text>
              </View>
            </View>
          ))}
          <Button mode="contained" style={styles.continueBtn} contentStyle={styles.bigBtn}
            onPress={() => router.push('/(auth)/signup')}>
            Crear cuenta gratis
          </Button>
          <Button mode="text" onPress={() => router.push('/(auth)/login')}>
            Ya tengo cuenta
          </Button>
        </View>

      </Animated.View>

      {/* Step dots */}
      <View style={styles.dots}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.surface, overflow: 'hidden' },
  slides:     { flexDirection: 'row', width: width * 3, flex: 1 },
  slide:      { width, flex: 1, padding: Spacing.xl, justifyContent: 'center' },
  slidePain:  { backgroundColor: Colors.primary },
  slideSolution: { backgroundColor: '#0F2347' },
  slideFeatures: { backgroundColor: Colors.surface },
  painQuestion: { color: Colors.surface, marginBottom: Spacing.xl },
  painButtons: { gap: Spacing.md },
  yesBtn: { borderRadius: 50 }, noBtn: { borderRadius: 50, borderColor: Colors.surface },
  bigBtn: { paddingVertical: Spacing.sm },
  savingsBox: { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12, padding: Spacing.md, marginVertical: Spacing.lg, borderLeftWidth: 4, borderLeftColor: Colors.danger },
  savingsText: { ...Typography.label, color: '#FCA5A5' },
  continueBtn: { borderRadius: 50, marginTop: Spacing.xl },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.lg },
  featureTextWrap: { flex: 1 },
  featureIcon: { fontSize: 28 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingBottom: Spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 24 },
});

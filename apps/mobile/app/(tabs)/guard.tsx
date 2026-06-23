import { useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { supabase } from '../../lib/supabase';
import { useCars } from '../../hooks/useCars';
import { useGuard } from '../../hooks/useGuard';
import { useSubscription } from '../../hooks/useSubscription';
import { PaywallGate } from '../../components/PaywallGate';
import { GuardRecordingScreen } from '../../components/GuardRecordingScreen';
import { GuardResultCard } from '../../components/GuardResultCard';
import { GuardShareCard } from '../../components/GuardShareCard';
import { captureAndShareCard } from '../../lib/shareCard';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Copy } from '../../constants/copy';
import { EmptyState } from '../../components/EmptyState';

// ponytail: dropped the unused 'setup' state from the original union.
type ScreenState = 'idle' | 'recording' | 'processing' | 'result';

export default function GuardScreen() {
  const { cars } = useCars();
  const primary = cars[0];
  const { createSession, analyzeSession } = useGuard(primary?.id);
  const { profile } = useSubscription();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [screen, setScreen] = useState<ScreenState>('idle');
  const [shopName, setShopName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const shareCardRef = useRef<View>(null);

  if (!primary) {
    return <EmptyState icon="🛡" title="Sin auto registrado" body="Agrega un auto para usar el Modo Guardia." quote={null} />;
  }

  const handleStart = async () => {
    // Consent check — show once
    if (!profile?.guard_consent_given) {
      Alert.alert('Aviso de grabación', Copy.guardConsent, [
        { text: Copy.guardConsentDecline, style: 'cancel' },
        { text: Copy.guardConsentAccept, onPress: async () => {
          await supabase.from('profiles').update({ guard_consent_given: true })
            .eq('id', profile!.id);
          startRecording();
        }},
      ]);
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso requerido', 'Necesitamos acceso al micrófono.'); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

    const sid = await createSession(shopName || undefined);
    setSessionId(sid);

    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setScreen('recording');
  };

  const stopAndAnalyze = async () => {
    if (!sessionId) return;
    setScreen('processing');

    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri) { setScreen('idle'); return; }

    // Upload audio — keep whatever container the recorder produced (.m4a/.aac/.mp4).
    const ext = (uri.split('.').pop() || 'm4a').toLowerCase();
    const blob = await (await fetch(uri)).blob();
    await supabase.storage.from('guard-audio')
      .upload(`${sessionId}.${ext}`, blob, { contentType: `audio/${ext}` });

    try {
      const data = await analyzeSession(sessionId);
      setResult(data);
      setScreen('result');
    } catch {
      Alert.alert('Error', 'No se pudo analizar. Intenta nuevamente.');
      setScreen('idle');
    }
  };

  const handleShare = async () => {
    if (shareCardRef.current && sessionId) {
      await captureAndShareCard(shareCardRef, sessionId);
    }
  };

  const reset = () => {
    setScreen('idle'); setResult(null); setSessionId(null); setShopName('');
  };

  // Full-black recording overlay
  if (screen === 'recording') {
    return <GuardRecordingScreen onStop={stopAndAnalyze} shopName={shopName || undefined} />;
  }

  if (screen === 'result' && result) {
    return (
      <>
        {/* Hidden share card — captured by react-native-view-shot */}
        <View style={styles.hiddenCard}>
          <GuardShareCard
            ref={shareCardRef}
            trustLevel={result.trust_level}
            trustScore={result.trust_score}
            shopName={shopName || undefined}
            estimatedSavings={result.estimated_savings_mxn}
            date={new Date().toLocaleDateString('es-MX')}
          />
        </View>
        <GuardResultCard
          trustScore={result.trust_score}
          trustLevel={result.trust_level}
          summary={result.summary}
          flags={result.flags ?? []}
          estimatedSavings={result.estimated_savings_mxn}
          onShare={handleShare}
          onNewSession={reset}
        />
      </>
    );
  }

  return (
    <PaywallGate feature="guard">
      <View style={styles.container}>
        <Text style={[Typography.heading, styles.title]}>{Copy.guardHeadline}</Text>
        <Text style={[Typography.body, styles.sub]}>{Copy.guardSub}</Text>

        <View style={styles.carBadge}>
          <Text style={[Typography.label, { color: Colors.primary }]}>
            {primary.display_name ?? `${primary.brand} ${primary.model}`} · {primary.current_mileage?.toLocaleString('es-MX')} km
          </Text>
        </View>

        <TextInput
          label="Nombre del taller (opcional)"
          value={shopName}
          onChangeText={setShopName}
          style={styles.shopInput}
          left={<TextInput.Icon icon="store" />}
        />

        <Button mode="contained" icon="microphone"
          onPress={screen === 'processing' ? undefined : handleStart}
          loading={screen === 'processing'}
          style={styles.startBtn} contentStyle={styles.startBtnContent}>
          {screen === 'processing' ? Copy.guardAnalyzing : 'Iniciar Modo Guardia'}
        </Button>

        {/* How it works */}
        <View style={styles.steps}>
          {[
            { n: '1', text: 'Escribe el nombre del taller (opcional)' },
            { n: '2', text: 'Toca "Iniciar" antes de entrar al taller' },
            { n: '3', text: 'Guarda el teléfono — graba en silencio' },
            { n: '4', text: 'Toca "Detener" al salir — la IA analiza' },
          ].map(s => (
            <View key={s.n} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{s.n}</Text>
              </View>
              <Text style={Typography.body}>{s.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </PaywallGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.xl, paddingTop: 60 },
  title: { marginBottom: Spacing.sm },
  sub: { color: Colors.textSecondary, marginBottom: Spacing.lg },
  carBadge: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: Spacing.sm, marginBottom: Spacing.lg },
  shopInput: { marginBottom: Spacing.lg },
  startBtn: { borderRadius: 50, marginBottom: Spacing.xl },
  startBtnContent: { paddingVertical: Spacing.sm },
  steps: { gap: Spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: Colors.surface, fontWeight: '700', fontSize: 13 },
  hiddenCard: { position: 'absolute', left: -1000, top: -1000, opacity: 0 },
});

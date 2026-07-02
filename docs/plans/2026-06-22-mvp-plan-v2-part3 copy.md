# Bitácora MVP Plan v2 — Part 3: Guard, Referral, Paywall, GTM

*(Continues from part2. Tasks 9–13.)*

---

## Task 9: Modo Guardia — Full Implementation

**Files:**
- Create: `supabase/functions/guard-agent/index.ts`
- Create: `apps/mobile/hooks/useGuard.ts`
- Create: `apps/mobile/app/(tabs)/guard.tsx`
- Create: `apps/mobile/components/GuardRecordingScreen.tsx`
- Create: `apps/mobile/components/GuardResultCard.tsx`
- Create: `apps/mobile/components/GuardShareCard.tsx`
- Create: `apps/mobile/lib/shareCard.ts`

**Consumer insight — every UX decision:**
1. **Black screen during recording:** Guard must be invisible. The user puts the phone face-down or screen-off in the shop. Any visible UI signals to the mechanic that something is running. Black screen + silent recording = covert protection. Satisfies Mexico's high Uncertainty Avoidance (the user feels safe from retaliation).
2. **Consent banner on first use only:** Satisfies legal compliance and Uncertainty Avoidance. Shown once, stored in `profiles.guard_consent_given`. Never shown again. Don't erode trust with repeated warnings.
3. **"Mecánico honesto ✓" result framing:** Most sessions will be clean. Rewarding the clean session with positive reinforcement (operant conditioning) builds the habit loop: use Guard → feel validated → use Guard again. If the result were always neutral, there's no reward for using it.
4. **"Potencialmente te ahorró $X MXN":** Transaction Utility calculation shown after every session. This quantifies the value delivered even on green sessions ("Your mechanic's quotes were in line with market rates — you didn't overpay"). On red sessions, it shows the amount they were potentially going to lose.
5. **Shareable card:** The viral loop. A user who caught their mechanic overcharging shares the card on WhatsApp. Their friend asks "what app is that?" Referral without a referral program. Observability in Rogers' DOI = free organic growth.
6. **Free session counter decrement:** Decrement AFTER showing the result, not before. The user must see value before feeling the loss.

---

### Guard Agent Edge Function

Create `supabase/functions/guard-agent/index.ts`:

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import OpenAI from 'npm:openai';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Mexico market price ranges for common services (MXN, CDMX 2026)
// ponytail: hardcoded for MVP. Replace with DB table when regional expansion starts.
const MX_PRICE_BENCHMARKS = `
Cambio de aceite (convencional): $300-$600 MXN mano de obra, $200-$500 aceite
Cambio de aceite (sintético): $400-$800 MXN mano de obra, $400-$900 aceite
Cambio de balatas delanteras: $400-$800 MXN mano de obra, $400-$1,200 refacciones
Cambio de balatas traseras: $350-$700 MXN mano de obra
Cambio de amortiguadores (par): $600-$1,200 MXN mano de obra, $800-$2,500 refacciones
Alineación y balanceo: $350-$700 MXN
Cambio de batería: $200-$400 MXN mano de obra, $1,200-$2,800 refacción
Cambio de bujías (4 cilindros): $300-$600 MXN mano de obra, $400-$1,200 refacciones
Cambio de filtro de aire: $150-$300 MXN mano de obra, $150-$400 refacción
Cambio de anticongelante: $300-$600 MXN mano de obra, $200-$500 líquido
Revisión general: $300-$800 MXN
Cambio de banda de distribución: $1,200-$2,500 MXN mano de obra, $800-$2,000 refacciones
Diagnóstico computarizado: $300-$600 MXN
`;

// Estimate savings based on flags found
function estimateSavings(flags: any[]): number {
  let total = 0;
  for (const flag of flags) {
    if (flag.severity === 'high') total += 1200;
    else if (flag.severity === 'medium') total += 500;
    else total += 200;
  }
  return total;
}

Deno.serve(async (req) => {
  const { session_id } = await req.json();

  const { data: session } = await supabase
    .from('guard_sessions')
    .select('*, cars(id, brand, model, year, current_mileage, owner_id)')
    .eq('id', session_id)
    .single();
  if (!session) return new Response('Not found', { status: 404 });

  await supabase.from('guard_sessions').update({ status: 'processing' }).eq('id', session_id);

  const car = session.cars;

  try {
    // 1. Get signed URL for audio
    const { data: { signedUrl } } = await supabase.storage
      .from('guard-audio')
      .createSignedUrl(`${session_id}.m4a`, 300);

    // 2. Transcribe via Whisper
    let transcript = '';
    if (signedUrl) {
      const audioRes = await fetch(signedUrl);
      const audioBlob = await audioRes.blob();
      const whisper = await openai.audio.transcriptions.create({
        file: new File([audioBlob], 'audio.m4a', { type: 'audio/m4a' }),
        model: 'whisper-1',
        language: 'es',
      });
      transcript = whisper.text;
    }

    if (!transcript || transcript.trim().length < 20) {
      await supabase.from('guard_sessions').update({
        status: 'failed',
        error_message: 'No se pudo transcribir el audio. Asegúrate de grabar con el teléfono cerca.',
      }).eq('id', session_id);
      // Delete audio regardless
      await supabase.storage.from('guard-audio').remove([`${session_id}.m4a`]);
      return new Response(JSON.stringify({ error: 'transcription_failed' }), { status: 400 });
    }

    // 3. Fetch car service context
    const { data: history } = await supabase
      .from('service_records').select('*').eq('car_id', car.id)
      .order('service_date', { ascending: false }).limit(8);

    const { data: parts } = await supabase
      .from('parts').select('*').eq('car_id', car.id);

    // 4. Analyze with Claude
    const analysis = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: `Eres un mecánico experto con 20 años de experiencia en México y un asesor de protección al consumidor.
Ayudas a dueños de autos a verificar que los mecánicos sean honestos.
Conoces los precios de mercado para servicios automotrices en México (CDMX, 2026).
REGLA CRÍTICA: Solo marca como RED (grave) cuando estás MUY seguro de que hay un problema real.
Para casos dudosos, usa YELLOW. Es preferible un falso negativo que un falso positivo.
Un mecánico honesto no merece ser acusado injustamente.
Responde SIEMPRE en español.`,
      messages: [{
        role: 'user',
        content: `Analiza la siguiente conversación con un mecánico. Verifica si los servicios recomendados, los precios cobrados y el diagnóstico son razonables.

AUTO DEL CLIENTE:
- ${car.brand} ${car.model} ${car.year}
- Kilometraje actual: ${car.current_mileage?.toLocaleString('es-MX') ?? 'N/A'} km

HISTORIAL DE SERVICIOS RECIENTES:
${history?.map(r => `- ${r.service_date}: ${r.services?.join(', ')} @ ${r.mileage_at_service?.toLocaleString('es-MX')} km${r.total_cost_mxn ? ` — $${r.total_cost_mxn} MXN` : ''}`).join('\n') || 'Sin historial disponible'}

REFACCIONES INSTALADAS RECIENTEMENTE:
${parts?.map(p => `- ${p.part_name}: instalada a ${p.installed_mileage?.toLocaleString('es-MX')} km${p.expected_lifetime_km ? `, duración esperada: ${p.expected_lifetime_km?.toLocaleString('es-MX')} km` : ''}`).join('\n') || 'Sin refacciones registradas'}

PRECIOS DE REFERENCIA EN CDMX (2026):
${MX_PRICE_BENCHMARKS}

TRANSCRIPCIÓN DE LA CONVERSACIÓN:
"${transcript}"

Responde con este JSON exacto:
{
  "trust_score": 85,
  "trust_level": "green",
  "summary": "Resumen en 2 oraciones de lo que encontraste. Empieza con el veredicto general.",
  "flags": [
    {
      "type": "overcharge",
      "severity": "high",
      "description": "Descripción clara del problema en español.",
      "mechanic_quote": "texto exacto que dijo el mecánico sobre este punto",
      "reference_data": "el dato o precio de referencia que usaste para comparar"
    }
  ]
}

Tipos de flag: overcharge, unnecessary_service, premature_replacement, inconsistent_diagnosis
Niveles de severidad: low, medium, high
trust_score: 0-100 (100 = completamente honesto, 0 = múltiples señales graves)
trust_level: "green" (score >= 75), "yellow" (40-74), "red" (< 40)
Si no hay problemas, devuelve flags: []`,
      }],
    });

    const raw = analysis.content[0].type === 'text' ? analysis.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in analysis response');
    const result = JSON.parse(jsonMatch[0]);

    // 5. Estimate savings
    const estimatedSavings = result.flags.length > 0 ? estimateSavings(result.flags) : 0;

    // 6. Decrement free sessions if applicable
    const { data: profile } = await supabase.from('profiles')
      .select('free_guard_sessions_remaining').eq('id', car.owner_id).single();
    const { data: sub } = await supabase.from('subscriptions')
      .select('plan').eq('user_id', car.owner_id).maybeSingle();
    const isPaidGuard = sub?.plan === 'pro_guard';
    if (!isPaidGuard && profile && profile.free_guard_sessions_remaining > 0) {
      await supabase.from('profiles')
        .update({ free_guard_sessions_remaining: profile.free_guard_sessions_remaining - 1 })
        .eq('id', car.owner_id);
    }

    // 7. Delete audio (privacy — only transcript persists)
    await supabase.storage.from('guard-audio').remove([`${session_id}.m4a`]);

    // 8. Save final result
    await supabase.from('guard_sessions').update({
      status: 'complete',
      transcript,
      trust_score: result.trust_score,
      trust_level: result.trust_level,
      flags: result.flags,
      summary: result.summary,
      estimated_savings_mxn: estimatedSavings,
      ended_at: new Date().toISOString(),
    }).eq('id', session_id);

    return new Response(JSON.stringify({ ...result, estimated_savings_mxn: estimatedSavings }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Always delete audio on failure too
    await supabase.storage.from('guard-audio').remove([`${session_id}.m4a`]).catch(() => {});
    await supabase.from('guard_sessions').update({
      status: 'failed',
      error_message: (err as Error).message,
    }).eq('id', session_id);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
```

---

### useGuard Hook

Create `apps/mobile/hooks/useGuard.ts`:

```typescript
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GuardSession } from '../types';

export function useGuard(carId?: string) {
  const [sessions, setSessions] = useState<GuardSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GuardSession | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!carId) return;
    const { data } = await supabase.from('guard_sessions')
      .select('*').eq('car_id', carId)
      .order('started_at', { ascending: false }).limit(20);
    if (data) setSessions(data);
  }, [carId]);

  const createSession = async (shopName?: string): Promise<string> => {
    const { data, error } = await supabase.from('guard_sessions').insert({
      car_id: carId,
      status: 'recording',
      shop_name: shopName,
    }).select().single();
    if (error) throw error;
    setCurrentSession(data);
    return data.id;
  };

  const analyzeSession = async (sessionId: string): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('guard-agent', {
      body: { session_id: sessionId },
    });
    if (error) throw error;
    await fetchSessions();
    return data;
  };

  return { sessions, currentSession, fetchSessions, createSession, analyzeSession };
}
```

---

### Guard Recording Screen Component

Create `apps/mobile/components/GuardRecordingScreen.tsx`:

```tsx
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
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.guardBg} />
      <Animated.View style={[styles.dot, { transform: [{ scale: pulse }] }]} />
      <Text style={styles.status}>{Copy.guardRecording}</Text>
      <Text style={styles.sub}>{Copy.guardRecordingSub}</Text>
      {shopName && <Text style={styles.shop}>{shopName}</Text>}
      <Button mode="outlined" onPress={onStop} style={styles.stopBtn}
        textColor={Colors.guardText} style={styles.stopBtn}>
        {Copy.guardStop}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
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
```

---

### Guard Result Card Component

Create `apps/mobile/components/GuardResultCard.tsx`:

```tsx
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Chip } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { GuardFlag } from '../types';
import { Copy } from '../constants/copy';

const TRUST_CONFIG = {
  green: { color: Colors.accent, label: Copy.guardResultHonest, bg: '#F0FDF4' },
  yellow: { color: Colors.warning, label: Copy.guardResultWarning, bg: '#FFFBEB' },
  red: { color: Colors.danger, label: Copy.guardResultDanger, bg: '#FEF2F2' },
};

const FLAG_LABELS: Record<string, string> = {
  overcharge: 'Cobro excesivo',
  unnecessary_service: 'Servicio innecesario',
  premature_replacement: 'Reemplazo prematuro',
  inconsistent_diagnosis: 'Diagnóstico inconsistente',
};

const SEVERITY_COLOR: Record<string, string> = {
  high: Colors.danger, medium: Colors.warning, low: Colors.textSecondary,
};

interface Props {
  trustScore: number;
  trustLevel: 'green' | 'yellow' | 'red';
  summary: string;
  flags: GuardFlag[];
  estimatedSavings?: number;
  onShare: () => void;
  onNewSession: () => void;
}

export function GuardResultCard({ trustScore, trustLevel, summary, flags, estimatedSavings, onShare, onNewSession }: Props) {
  const config = TRUST_CONFIG[trustLevel];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Score ring */}
      <View style={[styles.scoreRing, { borderColor: config.color, backgroundColor: config.bg }]}>
        <Text style={[Typography.hero, { color: config.color }]}>{trustScore}</Text>
        <Text style={[Typography.caption, { color: config.color }]}>/100</Text>
      </View>

      <Text style={[Typography.heading, { textAlign: 'center', color: config.color, marginBottom: Spacing.sm }]}>
        {config.label}
      </Text>

      <Text style={[Typography.body, styles.summary]}>{summary}</Text>

      {/* Savings callout */}
      {estimatedSavings !== undefined && estimatedSavings > 0 && (
        <View style={styles.savingsBox}>
          <Text style={styles.savingsLabel}>{Copy.guardSavedPrefix}</Text>
          <Text style={styles.savingsAmount}>${estimatedSavings.toLocaleString('es-MX')} MXN</Text>
        </View>
      )}
      {estimatedSavings === 0 && trustLevel === 'green' && (
        <View style={[styles.savingsBox, { backgroundColor: '#F0FDF4', borderColor: Colors.accent }]}>
          <Text style={[styles.savingsLabel, { color: Colors.accent }]}>
            Los precios del mecánico están dentro del rango de mercado. No detectamos sobrecobros.
          </Text>
        </View>
      )}

      {/* Flags */}
      {flags.length > 0 && (
        <View style={styles.flagsSection}>
          <Text style={[Typography.label, { marginBottom: Spacing.sm }]}>
            Alertas detectadas ({flags.length})
          </Text>
          {flags.map((flag, i) => (
            <View key={i} style={[styles.flagCard, { borderLeftColor: SEVERITY_COLOR[flag.severity] }]}>
              <Chip compact selectedColor={SEVERITY_COLOR[flag.severity]}
                style={styles.flagChip}>
                {FLAG_LABELS[flag.type] ?? flag.type}
              </Chip>
              <Text style={[Typography.body, { marginTop: Spacing.sm }]}>{flag.description}</Text>
              {flag.mechanic_quote && (
                <Text style={styles.quote}>"{flag.mechanic_quote}"</Text>
              )}
              {flag.reference_data && (
                <Text style={styles.ref}>Referencia: {flag.reference_data}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <Button mode="contained" icon="share-variant" onPress={onShare} style={styles.shareBtn}>
        {Copy.guardShareCta}
      </Button>
      <Button mode="outlined" onPress={onNewSession} style={styles.newBtn}>
        {Copy.guardNewSession}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl, alignItems: 'center' },
  scoreRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  summary: { textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.lg },
  savingsBox: { backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: Colors.warning, borderRadius: 12, padding: Spacing.md, width: '100%', marginBottom: Spacing.lg, alignItems: 'center' },
  savingsLabel: { ...Typography.label, color: Colors.warning, textAlign: 'center' },
  savingsAmount: { fontSize: 28, fontWeight: '800', color: Colors.warning, marginTop: 4 },
  flagsSection: { width: '100%', marginBottom: Spacing.lg },
  flagCard: { borderLeftWidth: 4, backgroundColor: Colors.background, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.sm },
  flagChip: { alignSelf: 'flex-start', marginBottom: Spacing.xs },
  quote: { ...Typography.caption, fontStyle: 'italic', color: Colors.textSecondary, marginTop: Spacing.xs },
  ref: { ...Typography.caption, color: Colors.primary, marginTop: Spacing.xs },
  shareBtn: { borderRadius: 50, width: '100%', marginBottom: Spacing.sm },
  newBtn: { borderRadius: 50, width: '100%' },
});
```

---

### Guard Share Card + shareCard lib

Create `apps/mobile/lib/shareCard.ts`:
```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { supabase } from './supabase';
import { RefObject } from 'react';

export async function captureAndShareCard(
  viewRef: RefObject<any>,
  sessionId: string,
): Promise<void> {
  // Capture the card view as PNG
  const uri = await captureRef(viewRef, { format: 'png', quality: 0.95 });

  // Upload to guard-cards bucket for persistence
  const filename = `${sessionId}.png`;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const { error } = await supabase.storage.from('guard-cards')
    .upload(filename, decode(base64), { contentType: 'image/png', upsert: true });

  if (!error) {
    const { data: { publicUrl } } = supabase.storage.from('guard-cards').getPublicUrl(filename);
    await supabase.from('guard_sessions').update({ share_card_url: publicUrl }).eq('id', sessionId);
  }

  // Share locally
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir resultado de Guardia' });
}

function decode(base64: string): Uint8Array {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return arr;
}
```

Create `apps/mobile/components/GuardShareCard.tsx` — a `View` with `ref` that renders the shareable card image (not shown on screen, only captured):
```tsx
import { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

interface Props {
  trustLevel: 'green' | 'yellow' | 'red';
  trustScore: number;
  shopName?: string;
  estimatedSavings?: number;
  date: string;
}

const LEVEL_EMOJI = { green: '🟢', yellow: '🟡', red: '🔴' };
const LEVEL_TEXT = { green: 'Mecánico honesto', yellow: 'Revisar detalles', red: 'Alerta de cobro' };
const LEVEL_COLOR = { green: Colors.accent, yellow: Colors.warning, red: Colors.danger };

export const GuardShareCard = forwardRef<View, Props>(function GuardShareCard(
  { trustLevel, trustScore, shopName, estimatedSavings, date },
  ref
) {
  return (
    <View ref={ref} style={styles.card}>
      <Text style={styles.appName}>🛡 Bitácora</Text>
      <Text style={styles.emoji}>{LEVEL_EMOJI[trustLevel]}</Text>
      <Text style={[styles.verdict, { color: LEVEL_COLOR[trustLevel] }]}>
        {LEVEL_TEXT[trustLevel]}
      </Text>
      {shopName && <Text style={styles.shop}>{shopName} · {date}</Text>}
      <Text style={styles.score}>Puntaje: {trustScore}/100</Text>
      {estimatedSavings !== undefined && estimatedSavings > 0 && (
        <Text style={styles.savings}>Ahorro estimado: ${estimatedSavings.toLocaleString('es-MX')} MXN</Text>
      )}
      <Text style={styles.cta}>bitacora.app — Protege tu auto y tu dinero</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: 360, padding: Spacing.xl, backgroundColor: '#0F172A', alignItems: 'center', borderRadius: 20 },
  appName: { color: '#94A3B8', fontSize: 14, marginBottom: Spacing.lg },
  emoji: { fontSize: 48, marginBottom: Spacing.sm },
  verdict: { fontSize: 24, fontWeight: '800', marginBottom: Spacing.xs },
  shop: { color: '#94A3B8', fontSize: 13, marginBottom: Spacing.sm },
  score: { color: '#E2E8F0', fontSize: 14, marginBottom: Spacing.sm },
  savings: { color: Colors.warning, fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm },
  cta: { color: '#475569', fontSize: 12, marginTop: Spacing.md },
});
```

---

### Guard Tab Screen

Create `apps/mobile/app/(tabs)/guard.tsx`:

```tsx
import { useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { Audio } from 'expo-av';
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

type ScreenState = 'idle' | 'setup' | 'recording' | 'processing' | 'result';

export default function GuardScreen() {
  const { cars } = useCars();
  const primary = cars[0];
  const { createSession, analyzeSession } = useGuard(primary?.id);
  const { canUseGuard, profile } = useSubscription();

  const [screen, setScreen] = useState<ScreenState>('idle');
  const [shopName, setShopName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [result, setResult] = useState<any>(null);
  const shareCardRef = useRef(null);

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
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const sid = await createSession(shopName || undefined);
    setSessionId(sid);

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    setRecording(recording);
    setScreen('recording');
  };

  const stopAndAnalyze = async () => {
    if (!recording || !sessionId) return;
    setScreen('processing');

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) { setScreen('idle'); return; }

    // Upload audio
    const res = await fetch(uri);
    const blob = await res.blob();
    await supabase.storage.from('guard-audio')
      .upload(`${sessionId}.m4a`, blob, { contentType: 'audio/m4a' });

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
    setScreen('idle'); setResult(null); setSessionId(null);
    setRecording(null); setShopName('');
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
```

- [ ] Deploy guard-agent: `supabase functions deploy guard-agent --no-verify-jwt`
- [ ] Test: record 30s saying services + prices, verify result screen shows trust score + savings
- [ ] Test share: tap share button, verify card captures and opens share sheet
- [ ] Commit: `feat(ai): guard agent, Modo Guardia screen, share card, savings estimate`

---

## Task 10: Document Vault + Tabs Navigation

*(Same as v1 but with design system applied.)*

- [ ] Build `apps/mobile/app/(tabs)/docs.tsx` — file picker + upload to `car-documents`, list with expiry badges. Red badge if `daysLeft < 30`.
- [ ] Build `apps/mobile/app/(tabs)/_layout.tsx` — 5 tabs: Inicio / Servicios / Piezas / Docs / Guardia.
- [ ] Apply design system colors and spacing throughout.
- [ ] Commit: `feat(mobile): doc vault, tabs layout`

---

## Task 11: Paywall + Referral System

**Files:**
- Create: `apps/mobile/app/paywall.tsx`
- Create: `apps/mobile/app/referral.tsx`
- Create: `apps/mobile/hooks/useReferral.ts`

**Consumer insight:** Paywall leads with the Value Equation math, not with features. Features are table stakes (PoP). The math is the PoD. "Una sesión de Guardia que detecte un cobro de más te paga 8 meses de suscripción" is the Transaction Utility argument. It makes $149 MXN feel like a financial decision with a clear ROI, not a subscription cost.

- [ ] **Step 1: Build paywall screen**

Create `apps/mobile/app/paywall.tsx`:
```tsx
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Copy } from '../constants/copy';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

// ponytail: no Stripe in MVP. Manual plan upgrade via Supabase directly.
// Replace with RevenueCat when payment flow is needed.
async function activateTrial() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);
  await supabase.from('subscriptions').upsert({
    user_id: user.id,
    plan: 'pro_guard',
    valid_until: trialEnd.toISOString().split('T')[0],
  }, { onConflict: 'user_id' });
}

export default function PaywallScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[Typography.hero, styles.headline]}>{Copy.paywallHeadline}</Text>
      <Text style={[Typography.body, styles.sub]}>{Copy.paywallSub}</Text>

      {/* Math box */}
      <Card style={styles.mathCard}>
        <Card.Content>
          <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
            El cálculo
          </Text>
          {[
            { label: 'Multa por verificación vencida', value: '$3,000–$5,000 MXN' },
            { label: 'Sobrecobro promedio por visita', value: '$1,200 MXN' },
            { label: 'Seguro vencido (multa)', value: '$2,000 MXN' },
            { label: 'Bitácora Pro + Guardia / año', value: '$1,788 MXN' },
          ].map(r => (
            <View key={r.label} style={styles.row}>
              <Text style={Typography.body}>{r.label}</Text>
              <Text style={[Typography.label, { color: Colors.textPrimary }]}>{r.value}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[Typography.label, { color: Colors.accent }]}>ROI potencial en 1 incidente</Text>
            <Text style={[Typography.title, { color: Colors.accent }]}>47x</Text>
          </View>
        </Card.Content>
      </Card>

      <Text style={[Typography.body, styles.cta]}>{Copy.paywallMath}</Text>

      {/* Plans */}
      <Card style={styles.planCard}>
        <Card.Content>
          <Text style={[Typography.title, { marginBottom: Spacing.xs }]}>Pro + Guardia</Text>
          <Text style={[Typography.hero, { color: Colors.primary }]}>$149 <Text style={Typography.body}>MXN/mes</Text></Text>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
            Menos que un tanque de gasolina al mes
          </Text>
          {['Historial ilimitado', 'Modo Guardia ilimitado', 'Recordatorios inteligentes', 'Bóveda de documentos', 'Verificación vehicular automática'].map(f => (
            <Text key={f} style={[Typography.body, { marginBottom: 4 }]}>✓ {f}</Text>
          ))}
          <Button mode="contained" style={styles.activateBtn}
            onPress={async () => { await activateTrial(); router.replace('/(tabs)/'); }}>
            Probar 7 días gratis
          </Button>
        </Card.Content>
      </Card>

      <Button mode="text" onPress={() => router.back()}>
        {Copy.paywallFreeCta}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl },
  headline: { marginBottom: Spacing.sm },
  sub: { color: Colors.textSecondary, marginBottom: Spacing.lg },
  mathCard: { marginBottom: Spacing.lg, borderRadius: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  totalRow: { borderBottomWidth: 0, marginTop: Spacing.sm, paddingTop: Spacing.sm },
  cta: { textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.xl },
  planCard: { marginBottom: Spacing.md, borderRadius: 16, borderWidth: 2, borderColor: Colors.primary },
  activateBtn: { borderRadius: 50, marginTop: Spacing.lg },
});
```

- [ ] **Step 2: Build referral hook + screen**

Create `apps/mobile/hooks/useReferral.ts`:
```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useReferral() {
  const [code, setCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { count }] = await Promise.all([
        supabase.from('profiles').select('referral_code').eq('id', user.id).single(),
        supabase.from('referral_events').select('*', { count: 'exact', head: true }).eq('referrer_id', user.id),
      ]);
      if (prof) setCode(prof.referral_code);
      if (count !== null) setReferralCount(count);
    })();
  }, []);

  const shareLink = code ? `https://bitacora.app/r/${code}` : null;
  const shareText = code ? Copy.referralShareText(code) : '';

  return { code, referralCount, shareLink, shareText };
}
```

Create `apps/mobile/app/referral.tsx` — displays referral code + share button using `expo-sharing` + shows count of referred users + sessions earned.

- [ ] **Step 3: Commit**
```bash
git add apps/mobile/app/paywall.tsx apps/mobile/app/referral.tsx apps/mobile/hooks/useReferral.ts
git commit -m "feat(growth): paywall with value equation math, 7-day trial, referral system"
```

---

## Task 12: Health Score + Final Smoke Test

*(Same computeHealthScore from v1 wired into maintenance-agent. Already included in Task 7.)*

- [ ] **Full smoke test checklist:**
  - [ ] Fresh signup via onboarding (tap "Sí me ha pasado" on screen 1)
  - [ ] Add car: Nissan Sentra 2019, plates ABC-123, holograma 0, 45,000 km
  - [ ] Import logbook photo via OCR — verify records created
  - [ ] Add oil change service record manually
  - [ ] Add bujías as installed part: 40,000 km, 30,000 km lifetime
  - [ ] Add insurance document expiring in 20 days
  - [ ] Manually invoke maintenance-agent — verify: reminder for bujías (5,000 km left), reminder for insurance, verificación checked, health score updated
  - [ ] Open Guardia tab — record 30s saying "me va a cobrar $3,000 por cambio de aceite"
  - [ ] Verify result: yellow or red, flags show overcharge, savings shown
  - [ ] Tap share — verify card opens in share sheet
  - [ ] Open paywall — verify math table renders, 7-day trial activates
  - [ ] Verify referral code generated on profile

- [ ] Commit: `feat(core): health score, smoke test complete, v1 ready`

---

## Environment Variables

```bash
# apps/mobile/.env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase edge function secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-...
```

---

## GTM Launch Sequence (Weeks 0–4)

These are operational tasks, not code tasks. Run in parallel with Tasks 10-12.

**Week 0 — Pre-launch:**
- Build a 1-page landing page at `bitacora.app`: headline = *"¿Tu mecánico es honesto?"*, subheadline = *"Bitácora usa IA para verificarlo."*, email waitlist CTA. Use Carrd or Framer — don't build it.
- Post in: r/mexico, r/autos, Facebook groups "Dueños de Nissan México", "Chevrolet Owners CDMX", "Mecánicos y talleres México" (from owner perspective), 3 CDMX WhatsApp car owner groups.
- Message: "¿Han tenido problemas con mecánicos que cobran de más? Estoy construyendo una app para eso — primeros 100 usuarios gratis."

**Week 1 — Soft launch:**
- 30 beta users from waitlist. Personal onboarding via WhatsApp. Get 5 Guard sessions run.
- Ask: "¿Qué pasó cuando usaste el Modo Guardia?" Collect stories.

**Week 2 — First content:**
- Create 3 TikTok/Instagram Reels: screen recording of Guard session with voiceover. Format: "Le dije a la IA lo que me cobró el mecánico y esto pasó 👀"
- No production value needed. Authenticity > polish for this category.

**Week 3 — Referral live:**
- Activate referral screen in app. DM every beta user with their referral link.
- Reach out to 5 Mexican car YouTubers/TikTokers. Offer 6 months free Pro + Guard. Ask for honest review demo.

**Week 4 — Conversion push:**
- Email waitlist: "Tu mecánico puede estar cobrando de más. Prueba Bitácora Guardia gratis 7 días."
- Show the ROI math. No discount. No urgency gimmick. Just the number.

---

*Plan complete — 3 parts. Bitácora MVP v2. Consumer-driven. Alan Ayala García · June 22, 2026.*

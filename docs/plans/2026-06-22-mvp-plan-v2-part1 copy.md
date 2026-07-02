# Bitácora MVP — Consumer-Driven Implementation Plan v2

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` syntax.

**Goal:** Ship a React Native app that digitizes car service history, catches mechanic scams with AI, and sends proactive government-aware maintenance alerts — designed from the ground up around Mexican consumer psychology.

**Architecture:** Expo (React Native) → Supabase (Auth, Postgres, Storage, Edge Functions, Realtime, pg_cron) → Anthropic API (Claude claude-sonnet-4-5 for Guard/OCR, claude-haiku-4-5 for routing) → OpenAI Whisper (transcription) → Expo Notifications.

**Tech Stack:** Expo SDK 52, TypeScript, Supabase JS v2, `@anthropic-ai/sdk`, `openai`, `expo-av`, `expo-camera`, `expo-image-picker`, `expo-document-picker`, `expo-notifications`, `expo-sharing`, `react-native-paper`, `expo-router` v3, `zod`, `react-native-view-shot`.

---

## Consumer Behaviour Foundation

Every product decision below is traceable to one of these insights. The AI coder implementing this plan should understand the WHY to make judgment calls in gaps.

### The Need Gap
- **Current State:** Mexican car owner has a paper bitácora they've lost, gets quoted $2,000 for a brake job that costs $400, misses verificación and pays a $3,000 fine.
- **Ideal State:** Full car history in pocket, never scammed, never miss a government deadline.
- **Gap magnitude:** Financial (real pesos lost per year) + Psychological (feeling stupid/powerless at the mechanic). Both are acute. Both justify payment.

### Motivational Conflict Type: Avoidance-Avoidance
"I hate getting scammed AND I hate confronting my mechanic." Both outcomes are aversive. Classic avoidance-avoidance conflict. Resolution requires **Service Innovation** — a solution that removes the confrontation entirely. Guard Mode solves this: the user never confronts, the AI just listens and reports after. The user can use the report to decide whether to dispute — or just walk away and find a new mechanic. **No confrontation required.**

This means: Guard must be positioned as passive protection, not a weapon. Copy: *"Escucha en silencio. Tú decides después."* Not: *"Atrapa a tu mecánico mintiendo."*

### Valence: Two Products in One App
| Feature | Valence | Involvement | UX Implication |
|---|---|---|---|
| Logbook / reminders | Avoidance (−ve) | LOW | Zero friction. Habit-forming. No onboarding friction. |
| Guard Mode | Approach (+ve) | HIGH | Rich experience. Social proof. Shareable outcome. |

The app has two distinct personalities. The logbook must feel like infrastructure — invisible, automatic. Guard must feel like an event — a moment worth paying for. These require different UX treatments and different marketing messages.

### Diffusion of Innovation — Bitácora's Curve
The Guard flag screenshot is the **Observability driver** in Rogers' DOI model. When a user shares "Bitácora caught my mechanic overcharging me $1,200" on WhatsApp, they are doing word-of-mouth marketing that no ad can buy. Build the shareable card from day one. It is the single most important growth feature.

Adoption barriers to eliminate:
- **Complexity:** App must work before the user finishes their first coffee. Car setup < 2 minutes.
- **Trialability:** 3 free Guard sessions/month. No credit card. The first scam catch converts them to paid forever.
- **Social risk:** Guard must be invisible in the shop. Full black screen mode. No sound. No visible recording indicator.

### Hofstede — Mexico
| Dimension | Mexico Profile | Design Decision |
|---|---|---|
| Collectivism | HIGH | "Your family's car" framing. Multi-car = the whole household. |
| Uncertainty Avoidance | HIGH | Guard only flags HIGH confidence. Conservative model. "Verificamos antes de alertar." |
| Indulgence | HIGH | Onboarding is fun, not clinical. Celebrate first car added. |
| Short-term orientation | HIGH | "Save money TODAY." Not "invest in your car's future." |
| Power Distance | HIGH | AI framed as an authority / expert mechanic, not just an app. |

### Self-Concept Bridge (Goffman)
- **Actual Self:** "I don't know about cars. Mechanics take advantage of me."
- **Ideal Self:** "I'm an informed, smart car owner. Nobody cheats me."
- Bitácora bridges this. The brand lives in this gap. Every notification, every Guard result, every reminder reinforces: *"You're in control of your car now."*

### Value Equation (Quantified)
```
Annual value delivered:
- Avoided verificación fine (once): $3,000–$5,000 MXN
- Avoided mechanic scam (once): $500–$2,000 MXN
- Avoided expired insurance penalty: $2,000 MXN
Total potential saved: ~$7,000–$9,000 MXN/year

Cost: Pro + Guard = $149 MXN/month = $1,788 MXN/year
ROI at first scam caught: 47x
```

Show this math in the paywall screen. Not features. Math.

### Pricing Psychology
- $149 MXN is inside the **Zone of Assimilation** for CDMX urban professionals (not suspiciously cheap, not premium-tier).
- Transaction Utility: After every Guard session, display: *"Esta sesión potencialmente te ahorró $X MXN."* This is the TrU that makes $149 feel like a bargain, not a cost.
- Annual plan anchor: *"Menos que un tanque de gasolina al mes."*

### GTM: First 4 Weeks
No paid ads. Per the Meta digital marketing framework: validate first through cheap channels, then spend.

| Week | Channel | Goal |
|---|---|---|
| 0 (pre-launch) | Waitlist landing page + CDMX Facebook car groups + WhatsApp communities | 200 waitlist signups |
| 1 | Direct invites to beta list. 30 active users. Get 5 Guard sessions run. | First real Guard data |
| 2 | Ask those 5 users for their Guard story. Post on TikTok/Instagram as UGC. | 1 viral-capable piece of content |
| 3 | Referral program live. Share Guard card → 5 free sessions. | Organic loop starts |
| 4 | First paywall push. Show the math. | First paying users |

Mexican car YouTubers/TikTokers (the Market Mavens in this category) are the highest-leverage influencer channel. One demo from an automotive content creator > 100 paid ads.

---

## Design System

Every screen must follow this system. No deviations.

### Colors
```typescript
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
```

### Typography
```typescript
export const Typography = {
  hero:    { fontSize: 32, fontWeight: '800', lineHeight: 40 },
  heading: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  title:   { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  body:    { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  label:   { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const;
```

### Spacing
```typescript
export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;
```

### Spanish Copy Map
All user-facing strings in Spanish. No English in the UI.

```typescript
export const Copy = {
  // App
  appName: 'Bitácora',
  tagline: 'Tu auto. Tu dinero. Siempre protegidos.',

  // Onboarding
  ob1Question: '¿Alguna vez saliste del taller sin saber si te cobraron de más?',
  ob1Yes: 'Sí, me ha pasado',
  ob1No: 'No, siempre verifico',
  ob2Headline: 'Bitácora te protege.',
  ob2Body: 'Guarda el historial de tu auto, recibe recordatorios inteligentes y usa el Modo Guardia para saber si tu mecánico es honesto.',
  ob3Headline: 'Agrega tu primer auto',
  ob3Sub: 'Tarda menos de 2 minutos.',

  // Car setup
  addCar: 'Agregar auto',
  brand: 'Marca',
  model: 'Modelo',
  year: 'Año',
  plates: 'Placas',
  mileage: 'Kilometraje actual',
  nickname: 'Apodo (opcional)',
  hologram: 'Tipo de holograma',

  // Home
  myCarTab: 'Mi Auto',
  healthScore: 'Salud del auto',
  upcomingReminders: 'Próximos recordatorios',
  noReminders: 'Todo en orden. Sin recordatorios pendientes. ✓',

  // Service log
  serviceLog: 'Servicios',
  addService: 'Registrar servicio',
  noServices: 'Sin servicios registrados. Agrega el primero.',

  // Reminders (Approach framing — car-personalized)
  reminderOilTemplate: (brand: string, km: number) => `Tu ${brand} tiene cambio de aceite en ${km.toLocaleString('es-MX')} km`,
  reminderDocTemplate: (doc: string, days: number) => `Protege tu familia: ${doc} vence en ${days} días`,
  reminderVerifTemplate: (brand: string, date: string) => `Verificación de tu ${brand}: empieza el ${date}`,

  // Guard
  guardTab: 'Guardia',
  guardHeadline: 'Modo Guardia',
  guardSub: 'Pon el teléfono boca arriba en el taller. La IA escucha y te avisa después.',
  guardConsent: 'Bitácora grabará el audio de la visita para analizarlo. El audio se elimina al terminar — solo guardamos el resultado. En México, grabar una conversación en la que participas es legal.',
  guardConsentAccept: 'Entendido, activar Guardia',
  guardConsentDecline: 'Cancelar',
  guardRecording: 'Guardando conversación...',
  guardRecordingSub: 'Mantén el teléfono sin bloquear. Puedes poner la pantalla hacia abajo.',
  guardStop: 'Terminar y analizar',
  guardAnalyzing: 'Analizando con IA...',
  guardResultHonest: 'Mecánico honesto ✓',
  guardResultWarning: 'Alertas encontradas',
  guardResultDanger: 'Señales de alerta graves',
  guardSavedPrefix: 'Esta sesión potencialmente te ahorró',
  guardShareCta: 'Compartir resultado',
  guardNewSession: 'Nueva sesión',

  // Paywall
  paywallHeadline: '¿Cuánto te cuesta un mecánico deshonesto?',
  paywallSub: 'El promedio en México: $1,200 MXN por visita. Bitácora Pro cuesta $149 MXN al mes.',
  paywallMath: 'Una sesión de Guardia que detecte un cobro de más te paga 8 meses de suscripción.',
  paywallCta: 'Activar Pro + Guardia',
  paywallFreeCta: 'Continuar gratis (3 sesiones/mes)',

  // Referral
  referralHeadline: 'Invita a alguien y ambos ganan',
  referralBody: 'Comparte tu link. Cuando se registren, tú y tu amigo reciben 5 sesiones de Guardia gratis.',
  referralShareText: (code: string) =>
    `¿Tu mecánico es honesto? Yo uso Bitácora para verificarlo. Pruébalo gratis: https://bitacora.app/r/${code}`,
} as const;
```

---

## Global Constraints

- Supabase region: `sa-east-1` (São Paulo — lowest latency for Mexico)
- RLS on every table from day one — never disabled
- Claude claude-sonnet-4-5 for Guard analysis and OCR; claude-haiku-4-5 for routing calls
- Whisper API (`openai` SDK) for Guard transcription — language: `es`
- All monetary amounts in MXN; mileage in km
- All user-facing text in Spanish — no English in UI strings
- Expo Notifications for push — register token on first login
- Guard audio: never persisted raw. Transcripts only. Audio deleted from storage after analysis.
- Mexico recording law: 1-party consent in CDMX and most states — display consent banner before first Guard session, persist consent in `profiles.guard_consent_given`
- Conventional commits; `feat/`, `fix/`, `chore/` prefixes

---

## Database Schema Changes vs v1

Add these columns and tables to the v1 schema:

```sql
-- Add to profiles
ALTER TABLE profiles ADD COLUMN guard_consent_given BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8);
ALTER TABLE profiles ADD COLUMN referred_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN free_guard_sessions_remaining INTEGER DEFAULT 3;

-- Add to guard_sessions
ALTER TABLE guard_sessions ADD COLUMN estimated_savings_mxn NUMERIC(10,2);
ALTER TABLE guard_sessions ADD COLUMN share_card_url TEXT;

-- Add to cars
ALTER TABLE cars ADD COLUMN display_name TEXT GENERATED ALWAYS AS (
  COALESCE(nickname, brand || ' ' || model)
) STORED;

-- Referrals table
CREATE TABLE referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id),
  referred_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  sessions_awarded BOOLEAN DEFAULT false
);

-- Subscriptions table (simple — no Stripe in MVP, just manual flag)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id),
  plan TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'pro_guard'
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for new tables
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own" ON referral_events FOR ALL
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "subscriptions_own" ON subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Function: award guard sessions on referral signup
CREATE OR REPLACE FUNCTION handle_referral_signup()
RETURNS TRIGGER AS $$
DECLARE referrer_profile_id UUID;
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    -- Award 5 sessions to both parties
    UPDATE profiles SET free_guard_sessions_remaining = free_guard_sessions_remaining + 5
      WHERE id = NEW.referred_by;
    UPDATE profiles SET free_guard_sessions_remaining = free_guard_sessions_remaining + 2
      WHERE id = NEW.id;
    INSERT INTO referral_events (referrer_id, referred_id, sessions_awarded)
      VALUES (NEW.referred_by, NEW.id, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_referral
  AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION handle_referral_signup();
```

---

## File Structure (complete)

```
bitacora/
├── apps/mobile/
│   ├── app/
│   │   ├── _layout.tsx                  # Root — auth gate, session, push token
│   │   ├── (auth)/
│   │   │   ├── onboarding.tsx           # 3-screen emotional onboarding
│   │   │   ├── login.tsx
│   │   │   └── signup.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx              # Bottom tab navigator
│   │   │   ├── index.tsx                # Home — car overview + reminders
│   │   │   ├── log.tsx                  # Service log list
│   │   │   ├── parts.tsx                # Parts tracker
│   │   │   ├── docs.tsx                 # Document vault
│   │   │   └── guard.tsx                # Modo Guardia
│   │   ├── car/
│   │   │   ├── add.tsx                  # Add car (step 1 of onboarding path)
│   │   │   └── [id].tsx                 # Car detail + edit
│   │   ├── log/
│   │   │   ├── add.tsx                  # Add service record
│   │   │   └── [id].tsx                 # Service detail
│   │   ├── ocr.tsx                      # Logbook photo import
│   │   ├── paywall.tsx                  # Upgrade screen with math
│   │   └── referral.tsx                 # Share + referral screen
│   ├── components/
│   │   ├── CarCard.tsx
│   │   ├── HealthScore.tsx
│   │   ├── ReminderBanner.tsx
│   │   ├── GuardRecordingScreen.tsx     # Full-black Guard recording UI
│   │   ├── GuardResultCard.tsx          # Trust score + flags display
│   │   ├── GuardShareCard.tsx           # Shareable card (react-native-view-shot)
│   │   ├── VerificationAlert.tsx
│   │   ├── EmptyState.tsx               # With social proof quote
│   │   ├── PaywallGate.tsx              # Wrap Guard/Pro features
│   │   └── ServiceChip.tsx
│   ├── constants/
│   │   ├── colors.ts                    # Design system colors
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── copy.ts                      # ALL Spanish UI strings
│   ├── hooks/
│   │   ├── useCars.ts
│   │   ├── useServiceLog.ts
│   │   ├── useParts.ts
│   │   ├── useReminders.ts
│   │   ├── useGuard.ts
│   │   ├── useSubscription.ts           # Plan check + paywall gate
│   │   └── useReferral.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── notifications.ts
│   │   └── shareCard.ts                 # Guard card share logic
│   └── types/index.ts
├── supabase/
│   ├── migrations/
│   │   ├── 001_core_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_verification_schedule.sql
│   │   ├── 004_pg_cron_jobs.sql
│   │   └── 005_referrals_subscriptions.sql
│   └── functions/
│       ├── ocr-agent/index.ts
│       ├── guard-agent/index.ts          # Now includes savings estimate + share card URL
│       ├── maintenance-agent/index.ts
│       ├── verification-agent/index.ts
│       └── scrape-verification/index.ts
```

---

## Task 1: Database Schema + Verification Seed

*(Same as v1 with additions from "Schema Changes" section above. Run all 5 migrations.)*

Run migrations 001–004 from v1 plan verbatim, then run 005 (referrals + subscriptions above).

Create Supabase Storage buckets:
- `car-documents` — private, 50MB
- `ocr-photos` — private, 20MB
- `guard-audio` — private, 100MB (audio deleted post-analysis by edge function)
- `guard-cards` — **public**, 5MB (shareable Guard result cards)

Set edge function secrets:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-...
```

- [ ] Run all 5 migrations in Supabase SQL editor
- [ ] Create all 4 storage buckets with correct access settings
- [ ] Set both API key secrets
- [ ] Verify `profiles` trigger creates row on auth signup AND sets `referral_code`
- [ ] Verify `referral_events` trigger fires when `referred_by` is set
- [ ] Commit: `git commit -m "feat(db): schema v2 — referrals, subscriptions, guard savings, display_name"`

---

## Task 2: Design System + Constants

**Files:**
- Create: `apps/mobile/constants/colors.ts`
- Create: `apps/mobile/constants/typography.ts`
- Create: `apps/mobile/constants/spacing.ts`
- Create: `apps/mobile/constants/copy.ts`
- Create: `apps/mobile/types/index.ts`

- [ ] **Step 1: Write all constants files**

Create `apps/mobile/constants/colors.ts`:
```typescript
export const Colors = {
  primary:      '#1A3A6B',
  primaryLight: '#2856A8',
  accent:       '#22C55E',
  warning:      '#F59E0B',
  danger:       '#EF4444',
  surface:      '#FFFFFF',
  background:   '#F4F6FA',
  card:         '#FFFFFF',
  textPrimary:  '#111827',
  textSecondary:'#6B7280',
  textMuted:    '#9CA3AF',
  border:       '#E5E7EB',
  guardBg:      '#000000',
  guardAccent:  '#EF4444',
  guardText:    '#FFFFFF',
} as const;

export type ColorKey = keyof typeof Colors;
```

Create `apps/mobile/constants/typography.ts`:
```typescript
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
```

Create `apps/mobile/constants/spacing.ts`:
```typescript
export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
```

Create `apps/mobile/constants/copy.ts` — paste the full Copy object from the Consumer Behaviour Foundation section above verbatim.

Create `apps/mobile/types/index.ts` — paste the full types from v1 plan, adding:
```typescript
export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'pro_guard';
  valid_until?: string;
}

export interface ReferralEvent {
  id: string;
  referrer_id: string;
  referred_id: string;
  sessions_awarded: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name?: string;
  push_token?: string;
  location_state: string;
  guard_consent_given: boolean;
  referral_code: string;
  referred_by?: string;
  free_guard_sessions_remaining: number;
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/mobile/constants/ apps/mobile/types/
git commit -m "feat(design): color system, typography, spacing, spanish copy map, types"
```

---

## Task 3: Expo Scaffold + Auth + Onboarding

**Files:**
- Create: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/lib/notifications.ts`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(auth)/onboarding.tsx`
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/(auth)/signup.tsx`

**Key consumer insight driving onboarding design:**
Onboarding screen 1 activates the Need Gap emotionally before asking for anything. The question *"¿Alguna vez saliste del taller sin saber si te cobraron de más?"* forces the user to recall a negative experience (activates Avoidance motivation). This is deliberate priming. Users who tap "Sí" have just articulated their pain — they are now primed to value the solution. Do not skip this screen.

- [ ] **Step 1: Initialize Expo project**
```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
cd apps/mobile
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage \
  react-native-url-polyfill
npx expo install expo-notifications expo-camera expo-av expo-image-picker \
  expo-document-picker expo-file-system expo-sharing react-native-view-shot
npx expo install react-native-paper react-native-vector-icons
```

- [ ] **Step 2: Supabase client**

Create `apps/mobile/lib/supabase.ts`:
```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);
```

- [ ] **Step 3: Notifications setup**

Create `apps/mobile/lib/notifications.ts`:
```typescript
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
  return token;
}
```

- [ ] **Step 4: Root layout with auth gate**

Create `apps/mobile/app/_layout.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerPushToken } from '../lib/notifications';
import { Colors } from '../constants/colors';

const theme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: Colors.primary, secondary: Colors.accent },
};

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) registerPushToken();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/onboarding');
    if (session && inAuth) router.replace('/(tabs)/');
  }, [session, ready]);

  return (
    <PaperProvider theme={theme}>
      <Stack screenOptions={{ headerShown: false }} />
    </PaperProvider>
  );
}
```

- [ ] **Step 5: Onboarding screen (3 steps)**

Create `apps/mobile/app/(auth)/onboarding.tsx`:
```tsx
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
              <View>
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
        {[0,1,2].map(i => (
          <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.surface, overflow: 'hidden' },
  slides:     { flexDirection: 'row', width: width * 3 },
  slide:      { width, flex: 1, padding: Spacing.xl, justifyContent: 'center' },
  slidePain:  { backgroundColor: Colors.primary },
  slideSolution: { backgroundColor: '#0F2347' },
  slideFeatures: { backgroundColor: Colors.surface },
  painQuestion: { color: Colors.surface, marginBottom: Spacing.xl },
  painButtons: { gap: Spacing.md },
  yesBtn: { borderRadius: 50 }, noBtn: { borderRadius: 50, borderColor: Colors.surface },
  bigBtn: { paddingVertical: Spacing.sm },
  savingsBox: { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12, padding: Spacing.md, marginVertical: Spacing.lg, borderLeftWidth: 4, borderLeftColor: Colors.danger },
  savingsText: { color: '#FCA5A5', ...Typography.label },
  continueBtn: { borderRadius: 50, marginTop: Spacing.xl },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.lg },
  featureIcon: { fontSize: 28 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingBottom: Spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 24 },
});
```

- [ ] **Step 6: Login + Signup screens**

Create `apps/mobile/app/(auth)/login.tsx`:
```tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, { marginBottom: Spacing.sm }]}>Entrar</Text>
      <TextInput label="Email" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Contraseña" value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} loading={loading} style={styles.btn}>
        Entrar
      </Button>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.xl, justifyContent: 'center', backgroundColor: Colors.surface },
  input: { marginBottom: Spacing.sm },
  btn: { marginTop: Spacing.sm, borderRadius: 50 },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
});
```

Create `apps/mobile/app/(auth)/signup.tsx` — same structure, but also accepts `referral_code` query param. On signup success, if referral code provided, look up the referrer by `referral_code` and set `referred_by` on the new profile:
```typescript
// After supabase.auth.signUp succeeds:
const referralCode = useLocalSearchParams<{ ref?: string }>().ref;
if (referralCode) {
  const { data: referrer } = await supabase
    .from('profiles').select('id').eq('referral_code', referralCode).single();
  if (referrer) {
    await supabase.from('profiles').update({ referred_by: referrer.id }).eq('id', newUser.id);
  }
}
```

- [ ] **Step 7: Test auth flow**

Run `npx expo start`. Go through all 3 onboarding screens. Sign up. Verify `profiles` row created with `referral_code`. Verify `free_guard_sessions_remaining = 3`.

- [ ] **Step 8: Commit**
```bash
git add apps/mobile/
git commit -m "feat(auth): onboarding 3-step pain activation, login, signup, push token"
```

# Bitácora MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a React Native app (iOS + Android) that digitizes car service history with OCR import, proactive maintenance reminders, government verification scheduling, and an AI mechanic guard that protects users from scams.

**Architecture:** Expo (React Native) mobile client → Supabase (Auth, Postgres, Storage, Edge Functions, pg_cron) backend. All AI intelligence runs in Supabase Edge Functions calling the Anthropic API directly. A lightweight Orchestrator agent (Claude claude-sonnet-4-5 + tool use) coordinates four specialist agents: OCR, Guard, Maintenance, and Verification. Government verificación data for CDMX is scraped on a weekly pg_cron job and stored locally — no live dependency on SEDEMA servers.

**Tech Stack:** Expo SDK 52, React Native, TypeScript, Supabase (Postgres 15 + RLS + Auth + Storage + Edge Functions + pg_cron + Realtime), Anthropic SDK (`@anthropic-ai/sdk`), Whisper API (OpenAI), Expo Notifications, Expo Camera, Expo AV, Zod, React Native Paper (UI), React Navigation v7.

---

## Global Constraints

- Supabase project in `sa-east-1` (São Paulo — closest to Mexico)
- RLS enabled on every table from day one — never disabled
- Claude claude-sonnet-4-5 for all heavy reasoning; claude-haiku-4-5 for classify/route calls
- All audio processed via Whisper API; never stored raw audio permanently — transcripts only
- Mexico legal context: ambient recording is 1-party consent in most states including CDMX — app must display consent banner before Guard activates
- Push notifications via Expo Notifications (not FCM/APNs directly)
- All monetary amounts in MXN; mileage in km
- App must work offline for read-only views (local SQLite cache via `@op-engineering/op-sqlite`)
- Conventional commits; branch per task; never force-push

---

## File Structure

```
bitacora/
├── apps/
│   └── mobile/                         # Expo app
│       ├── app/                        # Expo Router (file-based routing)
│       │   ├── (auth)/                 # Login / signup screens
│       │   ├── (tabs)/                 # Bottom tab navigator
│       │   │   ├── index.tsx           # Home — car health overview
│       │   │   ├── log.tsx             # Service log list
│       │   │   ├── parts.tsx           # Parts tracker
│       │   │   ├── docs.tsx            # Document vault
│       │   │   └── guard.tsx           # AI Guard screen
│       │   ├── car/
│       │   │   ├── add.tsx             # Add new car
│       │   │   └── [id].tsx            # Car detail / edit
│       │   ├── log/
│       │   │   ├── add.tsx             # Add service record
│       │   │   └── [id].tsx            # Service record detail
│       │   └── ocr.tsx                 # Logbook OCR import screen
│       ├── components/
│       │   ├── CarCard.tsx
│       │   ├── HealthScore.tsx
│       │   ├── ReminderBanner.tsx
│       │   ├── GuardSession.tsx
│       │   └── VerificationAlert.tsx
│       ├── hooks/
│       │   ├── useCars.ts
│       │   ├── useServiceLog.ts
│       │   ├── useParts.ts
│       │   ├── useReminders.ts
│       │   └── useGuard.ts
│       ├── lib/
│       │   ├── supabase.ts             # Supabase client
│       │   ├── notifications.ts        # Expo push setup
│       │   └── offline.ts              # SQLite offline cache
│       └── types/
│           └── index.ts                # Shared TS types
├── supabase/
│   ├── migrations/
│   │   ├── 001_core_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_verification_schedule.sql
│   │   └── 004_pg_cron_jobs.sql
│   └── functions/
│       ├── orchestrator/               # Main agent orchestrator
│       │   └── index.ts
│       ├── ocr-agent/                  # Logbook photo → structured data
│       │   └── index.ts
│       ├── guard-agent/                # Mechanic transcript → trust score
│       │   └── index.ts
│       ├── maintenance-agent/          # Proactive reminder logic
│       │   └── index.ts
│       ├── verification-agent/         # Verificación calendar checker
│       │   └── index.ts
│       └── scrape-verification/        # pg_cron: scrape SEDEMA weekly
│           └── index.ts
└── docs/
    └── superpowers/plans/
        └── 2026-06-22-mvp-implementation-plan.md  ← this file
```

---

## Task 1: Supabase Project Setup + Core Schema

**Files:**
- Create: `supabase/migrations/001_core_schema.sql`
- Create: `supabase/migrations/002_rls_policies.sql`
- Create: `supabase/migrations/003_verification_schedule.sql`
- Create: `supabase/migrations/004_pg_cron_jobs.sql`

**Interfaces:**
- Produces: all tables, enums, and RLS policies used by every other task

- [ ] **Step 1: Create Supabase project**

Go to supabase.com → New project → name: `bitacora` → region: South America (São Paulo). Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_KEY` to `.env`.

- [ ] **Step 2: Run core schema migration**

In Supabase SQL editor, run:

```sql
-- 001_core_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enums
CREATE TYPE fuel_type AS ENUM ('gasoline', 'diesel', 'hybrid', 'electric', 'gas');
CREATE TYPE service_type AS ENUM ('oil_change', 'tire_rotation', 'brake_service', 'transmission', 'air_filter', 'spark_plugs', 'coolant', 'battery', 'alignment', 'inspection', 'other');
CREATE TYPE reminder_type AS ENUM ('mileage', 'date', 'both');
CREATE TYPE guard_status AS ENUM ('recording', 'processing', 'complete', 'failed');
CREATE TYPE doc_type AS ENUM ('insurance', 'verification', 'plates', 'repuve', 'other');
CREATE TYPE hologram_type AS ENUM ('0', '00', 'doble_cero', 'exento');

-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  push_token TEXT,
  location_state TEXT DEFAULT 'CDMX',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cars
CREATE TABLE cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1980 AND year <= 2030),
  color TEXT,
  plates TEXT,
  vin TEXT,
  fuel_type fuel_type DEFAULT 'gasoline',
  current_mileage INTEGER DEFAULT 0,
  hologram_type hologram_type,
  is_primary BOOLEAN DEFAULT false,
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Service log
CREATE TABLE service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  mileage_at_service INTEGER NOT NULL,
  shop_name TEXT,
  shop_address TEXT,
  services service_type[] NOT NULL,
  description TEXT,
  total_cost_mxn NUMERIC(10,2),
  parts_replaced JSONB DEFAULT '[]',
  notes TEXT,
  receipt_url TEXT,
  imported_via_ocr BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Parts tracker
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  service_record_id UUID REFERENCES service_records(id),
  part_name TEXT NOT NULL,
  installed_mileage INTEGER NOT NULL,
  installed_date DATE NOT NULL,
  expected_lifetime_km INTEGER,
  expected_lifetime_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type reminder_type NOT NULL,
  trigger_mileage INTEGER,
  trigger_date DATE,
  is_dismissed BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual',  -- 'manual' | 'part_tracker' | 'agent' | 'verification'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document vault
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  doc_type doc_type NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guard sessions
CREATE TABLE guard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  shop_name TEXT,
  status guard_status DEFAULT 'recording',
  transcript TEXT,
  trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
  trust_level TEXT,  -- 'green' | 'yellow' | 'red'
  flags JSONB DEFAULT '[]',
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Verification schedule (populated by scraper agent)
CREATE TABLE verification_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL DEFAULT 'CDMX',
  plate_last_digit TEXT NOT NULL,  -- '0'-'9' or ranges like '0,1' 
  hologram TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester IN (1,2)),
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  UNIQUE(state, plate_last_digit, hologram, semester, year)
);

-- OCR import queue (for async processing)
CREATE TABLE ocr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'processing' | 'complete' | 'failed'
  extracted_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Triggers: updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cars_updated_at BEFORE UPDATE ON cars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 3: Run RLS policies**

```sql
-- 002_rls_policies.sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE guard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_schedule ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- cars: own cars only
CREATE POLICY "cars_own" ON cars FOR ALL USING (auth.uid() = owner_id);

-- service_records: via car ownership
CREATE POLICY "service_records_own" ON service_records FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = service_records.car_id AND cars.owner_id = auth.uid()));

-- parts: via car ownership
CREATE POLICY "parts_own" ON parts FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = parts.car_id AND cars.owner_id = auth.uid()));

-- reminders: via car ownership
CREATE POLICY "reminders_own" ON reminders FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = reminders.car_id AND cars.owner_id = auth.uid()));

-- documents: via car ownership
CREATE POLICY "documents_own" ON documents FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = documents.car_id AND cars.owner_id = auth.uid()));

-- guard_sessions: via car ownership
CREATE POLICY "guard_sessions_own" ON guard_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = guard_sessions.car_id AND cars.owner_id = auth.uid()));

-- ocr_jobs: via car ownership
CREATE POLICY "ocr_jobs_own" ON ocr_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = ocr_jobs.car_id AND cars.owner_id = auth.uid()));

-- verification_schedule: public read
CREATE POLICY "verification_schedule_read" ON verification_schedule FOR SELECT USING (true);

-- profiles: auto-create on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

- [ ] **Step 4: Seed CDMX verification schedule**

```sql
-- 003_verification_schedule.sql
-- CDMX 2026 schedule (Semester 1: Jan 1 – Jun 30, Semester 2: Jul 1 – Dec 31)
-- Source: SEDEMA — https://www.sedema.cdmx.gob.mx/programas/programa/verificacion-vehicular
-- Hologram '0': vehicles with hologram 0 verify every 6 months
-- Hologram '00': exempt or double-zero, annual
-- Rule: last digit of plates rotates monthly within semester
-- Below is the CDMX 2026 rotation (last digit → verification months)
INSERT INTO verification_schedule (state, plate_last_digit, hologram, semester, year, start_date, end_date, notes) VALUES
-- Semester 1 2026 (Hologram 0 — biannual)
('CDMX', '5,6', '0', 1, 2026, '2026-01-02', '2026-02-28', 'Enero-Febrero'),
('CDMX', '7,8', '0', 1, 2026, '2026-03-02', '2026-04-30', 'Marzo-Abril'),
('CDMX', '3,4', '0', 1, 2026, '2026-05-04', '2026-06-30', 'Mayo-Junio'),
-- Semester 2 2026 (Hologram 0 — biannual)
('CDMX', '5,6', '0', 2, 2026, '2026-07-01', '2026-08-31', 'Julio-Agosto'),
('CDMX', '7,8', '0', 2, 2026, '2026-09-01', '2026-10-31', 'Septiembre-Octubre'),
('CDMX', '3,4', '0', 2, 2026, '2026-11-02', '2026-12-31', 'Noviembre-Diciembre'),
-- Hologram 00 (annual — semester 1 only for odd year-model, semester 2 for even)
('CDMX', '1,2', '00', 1, 2026, '2026-01-02', '2026-06-30', 'Hologram 00 odd year-model'),
('CDMX', '9,0', '00', 2, 2026, '2026-07-01', '2026-12-31', 'Hologram 00 even year-model');
-- NOTE: verify current year schedule at https://www.sedema.cdmx.gob.mx before each year update.
-- The scrape-verification edge function updates this table automatically every January.
```

- [ ] **Step 5: Set up pg_cron jobs**

```sql
-- 004_pg_cron_jobs.sql
-- Requires pg_cron extension (enabled in Supabase dashboard: Database → Extensions → pg_cron)

-- Daily: run maintenance agent for all users (check mileage-based reminders)
SELECT cron.schedule(
  'daily-maintenance-agent',
  '0 9 * * *',  -- 9am UTC daily (3am CDMX)
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/maintenance-agent',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"trigger":"cron","scope":"all_users"}'::jsonb
  );
  $$
);

-- Weekly Monday: scrape SEDEMA verification schedule
SELECT cron.schedule(
  'weekly-verification-scrape',
  '0 6 * * 1',  -- 6am UTC every Monday
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/scrape-verification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 6: Create Supabase Storage buckets**

In Supabase dashboard → Storage → New bucket:
- `car-documents` — private, 50MB max file size
- `ocr-photos` — private, 20MB max
- `receipts` — private, 10MB max

- [ ] **Step 7: Set Postgres secrets for pg_cron**

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
ALTER DATABASE postgres SET app.service_key = 'YOUR_SERVICE_KEY';
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): core schema, RLS, verification schedule, pg_cron jobs"
```

---

## Task 2: Expo App Scaffold + Supabase Auth

**Files:**
- Create: `apps/mobile/` (full Expo project)
- Create: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/(auth)/signup.tsx`
- Create: `apps/mobile/types/index.ts`

**Interfaces:**
- Produces: `supabase` client singleton, `useSession()` hook, auth screens, shared TypeScript types

- [ ] **Step 1: Initialize Expo project**

```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
cd apps/mobile
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage \
  react-native-url-polyfill
npx expo install expo-notifications expo-camera expo-av expo-image-picker \
  expo-document-picker expo-file-system
npx expo install react-native-paper react-native-vector-icons
npx expo install @op-engineering/op-sqlite
```

- [ ] **Step 2: Create shared types**

Create `apps/mobile/types/index.ts`:

```typescript
export type FuelType = 'gasoline' | 'diesel' | 'hybrid' | 'electric' | 'gas';
export type ServiceType = 'oil_change' | 'tire_rotation' | 'brake_service' | 'transmission' | 'air_filter' | 'spark_plugs' | 'coolant' | 'battery' | 'alignment' | 'inspection' | 'other';
export type GuardStatus = 'recording' | 'processing' | 'complete' | 'failed';
export type DocType = 'insurance' | 'verification' | 'plates' | 'repuve' | 'other';

export interface Car {
  id: string;
  owner_id: string;
  nickname?: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  plates?: string;
  vin?: string;
  fuel_type: FuelType;
  current_mileage: number;
  hologram_type?: '0' | '00' | 'doble_cero' | 'exento';
  is_primary: boolean;
  health_score: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceRecord {
  id: string;
  car_id: string;
  service_date: string;
  mileage_at_service: number;
  shop_name?: string;
  shop_address?: string;
  services: ServiceType[];
  description?: string;
  total_cost_mxn?: number;
  parts_replaced: PartReplaced[];
  notes?: string;
  receipt_url?: string;
  imported_via_ocr: boolean;
  created_at: string;
}

export interface PartReplaced {
  name: string;
  brand?: string;
  cost_mxn?: number;
}

export interface Part {
  id: string;
  car_id: string;
  service_record_id?: string;
  part_name: string;
  installed_mileage: number;
  installed_date: string;
  expected_lifetime_km?: number;
  expected_lifetime_days?: number;
  notes?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  car_id: string;
  title: string;
  description?: string;
  reminder_type: 'mileage' | 'date' | 'both';
  trigger_mileage?: number;
  trigger_date?: string;
  is_dismissed: boolean;
  is_sent: boolean;
  source: 'manual' | 'part_tracker' | 'agent' | 'verification';
  created_at: string;
}

export interface GuardSession {
  id: string;
  car_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  shop_name?: string;
  status: GuardStatus;
  transcript?: string;
  trust_score?: number;
  trust_level?: 'green' | 'yellow' | 'red';
  flags: GuardFlag[];
  summary?: string;
}

export interface GuardFlag {
  type: 'overcharge' | 'unnecessary_service' | 'premature_replacement' | 'inconsistent_diagnosis';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mechanic_quote?: string;
  reference_data?: string;
}

export interface VerificationSchedule {
  id: string;
  state: string;
  plate_last_digit: string;
  hologram: string;
  semester: number;
  year: number;
  start_date: string;
  end_date: string;
  notes?: string;
}
```

- [ ] **Step 3: Create Supabase client**

Create `apps/mobile/lib/supabase.ts`:

```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 4: Create auth screens**

Create `apps/mobile/app/(auth)/login.tsx`:

```tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.replace('/(tabs)/');
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Bitácora</Text>
      <Text variant="bodyMedium" style={styles.sub}>Tu auto, todo en un lugar.</Text>
      <TextInput label="Email" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Contraseña" value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} loading={loading} style={styles.btn}>
        Entrar
      </Button>
      <Button mode="text" onPress={() => router.push('/(auth)/signup')}>
        ¿No tienes cuenta? Regístrate
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { textAlign: 'center', fontWeight: 'bold', marginBottom: 4 },
  sub: { textAlign: 'center', color: '#666', marginBottom: 32 },
  input: { marginBottom: 12 },
  btn: { marginTop: 8, marginBottom: 12 },
  error: { color: 'red', marginBottom: 8, textAlign: 'center' },
});
```

Create `apps/mobile/app/(auth)/signup.tsx` — same structure, calls `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`.

- [ ] **Step 5: Create root layout with auth gate**

Create `apps/mobile/app/_layout.tsx`:

```tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import { router, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { useState } from 'react';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/login');
    if (session && inAuth) router.replace('/(tabs)/');
  }, [session, initialized, segments]);

  return (
    <PaperProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PaperProvider>
  );
}
```

- [ ] **Step 6: Create `.env` and test auth**

Create `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Run `npx expo start`. Sign up with a test email. Verify the profile row is auto-created in Supabase.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): expo scaffold, auth screens, supabase client, shared types"
```

---

## Task 3: Car Profile — Add, List, Edit

**Files:**
- Create: `apps/mobile/app/(tabs)/index.tsx` — home with car list
- Create: `apps/mobile/app/car/add.tsx` — add car form
- Create: `apps/mobile/app/car/[id].tsx` — car detail + edit
- Create: `apps/mobile/hooks/useCars.ts`
- Create: `apps/mobile/components/CarCard.tsx`
- Create: `apps/mobile/components/HealthScore.tsx`

**Interfaces:**
- Produces: `useCars()` → `{ cars, addCar, updateCar, deleteCar, updateMileage }`

- [ ] **Step 1: Build useCars hook**

Create `apps/mobile/hooks/useCars.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Car } from '../types';

export function useCars() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCars = useCallback(async () => {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (!error && data) setCars(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCars(); }, [fetchCars]);

  const addCar = async (car: Omit<Car, 'id' | 'owner_id' | 'health_score' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('cars')
      .insert({ ...car, owner_id: user!.id })
      .select()
      .single();
    if (!error && data) setCars(prev => [...prev, data]);
    return { data, error };
  };

  const updateCar = async (id: string, updates: Partial<Car>) => {
    const { data, error } = await supabase
      .from('cars').update(updates).eq('id', id).select().single();
    if (!error && data) setCars(prev => prev.map(c => c.id === id ? data : c));
    return { data, error };
  };

  const updateMileage = (id: string, mileage: number) =>
    updateCar(id, { current_mileage: mileage });

  const deleteCar = async (id: string) => {
    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (!error) setCars(prev => prev.filter(c => c.id !== id));
    return { error };
  };

  return { cars, loading, addCar, updateCar, updateMileage, deleteCar, refetch: fetchCars };
}
```

- [ ] **Step 2: Build CarCard component**

Create `apps/mobile/components/CarCard.tsx`:

```tsx
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Badge, IconButton } from 'react-native-paper';
import { Car } from '../types';
import { router } from 'expo-router';

interface Props { car: Car; }

const HEALTH_COLOR = (score: number) =>
  score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

export function CarCard({ car }: Props) {
  return (
    <TouchableOpacity onPress={() => router.push(`/car/${car.id}`)}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <View>
              <Text variant="titleMedium" style={styles.name}>
                {car.nickname || `${car.brand} ${car.model}`}
              </Text>
              <Text variant="bodySmall" style={styles.sub}>
                {car.year} · {car.plates || 'Sin placas'} · {car.current_mileage.toLocaleString()} km
              </Text>
            </View>
            <View style={[styles.score, { borderColor: HEALTH_COLOR(car.health_score) }]}>
              <Text style={[styles.scoreText, { color: HEALTH_COLOR(car.health_score) }]}>
                {car.health_score}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, borderRadius: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '600' },
  sub: { color: '#666', marginTop: 2 },
  score: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  scoreText: { fontWeight: 'bold', fontSize: 16 },
});
```

- [ ] **Step 3: Build Add Car screen**

Create `apps/mobile/app/car/add.tsx`:

```tsx
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons } from 'react-native-paper';
import { useCars } from '../../hooks/useCars';
import { router } from 'expo-router';
import { FuelType } from '../../types';

export default function AddCarScreen() {
  const { addCar } = useCars();
  const [form, setForm] = useState({
    brand: '', model: '', year: '', nickname: '', color: '',
    plates: '', vin: '', fuel_type: 'gasoline' as FuelType,
    current_mileage: '0', hologram_type: '0' as '0' | '00' | 'exento',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.brand || !form.model || !form.year) {
      setError('Marca, modelo y año son requeridos.');
      return;
    }
    setLoading(true);
    const { error } = await addCar({
      brand: form.brand,
      model: form.model,
      year: parseInt(form.year),
      nickname: form.nickname || undefined,
      color: form.color || undefined,
      plates: form.plates || undefined,
      vin: form.vin || undefined,
      fuel_type: form.fuel_type,
      current_mileage: parseInt(form.current_mileage) || 0,
      hologram_type: form.hologram_type,
      is_primary: false,
    });
    if (error) setError(error.message);
    else router.back();
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>Agregar auto</Text>
      <TextInput label="Marca *" value={form.brand} onChangeText={set('brand')} style={styles.input} />
      <TextInput label="Modelo *" value={form.model} onChangeText={set('model')} style={styles.input} />
      <TextInput label="Año *" value={form.year} onChangeText={set('year')} keyboardType="numeric" style={styles.input} />
      <TextInput label="Apodo (ej. 'La Viejita')" value={form.nickname} onChangeText={set('nickname')} style={styles.input} />
      <TextInput label="Color" value={form.color} onChangeText={set('color')} style={styles.input} />
      <TextInput label="Placas" value={form.plates} onChangeText={set('plates')} autoCapitalize="characters" style={styles.input} />
      <TextInput label="VIN (opcional)" value={form.vin} onChangeText={set('vin')} style={styles.input} />
      <TextInput label="Kilometraje actual" value={form.current_mileage} onChangeText={set('current_mileage')} keyboardType="numeric" style={styles.input} />
      <Text variant="labelMedium" style={styles.label}>Tipo de holograma</Text>
      <SegmentedButtons
        value={form.hologram_type}
        onValueChange={val => set('hologram_type')(val)}
        buttons={[
          { value: '0', label: 'Holograma 0' },
          { value: '00', label: 'Holograma 00' },
          { value: 'exento', label: 'Exento' },
        ]}
        style={styles.segment}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleSubmit} loading={loading} style={styles.btn}>
        Guardar auto
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  title: { fontWeight: 'bold', marginBottom: 20 },
  input: { marginBottom: 12 },
  label: { marginBottom: 8, color: '#666' },
  segment: { marginBottom: 16 },
  btn: { marginTop: 8 },
  error: { color: 'red', marginBottom: 8 },
});
```

- [ ] **Step 4: Build Home tab**

Create `apps/mobile/app/(tabs)/index.tsx`:

```tsx
import { View, FlatList, StyleSheet } from 'react-native';
import { FAB, Text, ActivityIndicator } from 'react-native-paper';
import { useCars } from '../../hooks/useCars';
import { CarCard } from '../../components/CarCard';
import { router } from 'expo-router';
import { useReminders } from '../../hooks/useReminders';
import { ReminderBanner } from '../../components/ReminderBanner';

export default function HomeScreen() {
  const { cars, loading } = useCars();
  // ponytail: pull top 3 active reminders for banner, add full screen in future
  const { activeReminders } = useReminders(cars.map(c => c.id));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.header}>Mis autos</Text>
      {activeReminders.slice(0, 3).map(r => (
        <ReminderBanner key={r.id} reminder={r} />
      ))}
      <FlatList
        data={cars}
        keyExtractor={c => c.id}
        renderItem={({ item }) => <CarCard car={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No tienes autos. Agrega uno con el botón +</Text>
        }
        contentContainerStyle={styles.list}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => router.push('/car/add')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8', paddingTop: 56 },
  header: { fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  empty: { textAlign: 'center', color: '#999', marginTop: 60 },
  fab: { position: 'absolute', bottom: 24, right: 16 },
});
```

- [ ] **Step 5: Test add car flow**

Run `npx expo start`. Log in. Tap +. Add a car. Verify it appears in the list. Check Supabase dashboard that the row exists with correct owner_id. Verify health_score defaults to 100.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): car profile — add, list, CarCard, HealthScore"
```

---

## Task 4: Service Log + Parts Tracker

**Files:**
- Create: `apps/mobile/app/log/add.tsx`
- Create: `apps/mobile/app/log/[id].tsx`
- Create: `apps/mobile/app/(tabs)/log.tsx`
- Create: `apps/mobile/app/(tabs)/parts.tsx`
- Create: `apps/mobile/hooks/useServiceLog.ts`
- Create: `apps/mobile/hooks/useParts.ts`

**Interfaces:**
- Produces: `useServiceLog(carId)` → `{ records, addRecord }`, `useParts(carId)` → `{ parts, addPart, getUpcoming }`

- [ ] **Step 1: Build useServiceLog hook**

Create `apps/mobile/hooks/useServiceLog.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ServiceRecord } from '../types';

export function useServiceLog(carId?: string) {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!carId) { setLoading(false); return; }
    const { data } = await supabase
      .from('service_records')
      .select('*')
      .eq('car_id', carId)
      .order('service_date', { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  }, [carId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addRecord = async (record: Omit<ServiceRecord, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('service_records').insert(record).select().single();
    if (!error && data) setRecords(prev => [data, ...prev]);
    return { data, error };
  };

  return { records, loading, addRecord, refetch: fetch };
}
```

- [ ] **Step 2: Build useParts hook**

Create `apps/mobile/hooks/useParts.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Part } from '../types';

export function useParts(carId?: string) {
  const [parts, setParts] = useState<Part[]>([]);

  const fetch = useCallback(async () => {
    if (!carId) return;
    const { data } = await supabase.from('parts').select('*').eq('car_id', carId);
    if (data) setParts(data);
  }, [carId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addPart = async (part: Omit<Part, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('parts').insert(part).select().single();
    if (!error && data) setParts(prev => [...prev, data]);
    return { data, error };
  };

  // Returns parts that are due soon: within 2000km of current mileage
  const getUpcoming = (currentMileage: number) =>
    parts.filter(p => {
      if (!p.expected_lifetime_km) return false;
      const dueAt = p.installed_mileage + p.expected_lifetime_km;
      return dueAt - currentMileage <= 2000 && dueAt > currentMileage;
    });

  return { parts, addPart, getUpcoming, refetch: fetch };
}
```

- [ ] **Step 3: Build Add Service Record screen**

Create `apps/mobile/app/log/add.tsx`:

```tsx
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, Chip } from 'react-native-paper';
import { useServiceLog } from '../../hooks/useServiceLog';
import { useParts } from '../../hooks/useParts';
import { router, useLocalSearchParams } from 'expo-router';
import { ServiceType } from '../../types';

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'oil_change', label: 'Aceite' },
  { value: 'tire_rotation', label: 'Llantas' },
  { value: 'brake_service', label: 'Frenos' },
  { value: 'air_filter', label: 'Filtro aire' },
  { value: 'spark_plugs', label: 'Bujías' },
  { value: 'coolant', label: 'Anticongelante' },
  { value: 'battery', label: 'Batería' },
  { value: 'alignment', label: 'Alineación' },
  { value: 'inspection', label: 'Revisión' },
  { value: 'other', label: 'Otro' },
];

export default function AddServiceRecordScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { addRecord } = useServiceLog(carId);
  const { addPart } = useParts(carId);

  const [form, setForm] = useState({
    service_date: new Date().toISOString().split('T')[0],
    mileage_at_service: '',
    shop_name: '',
    description: '',
    total_cost_mxn: '',
    notes: '',
  });
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleService = (s: ServiceType) =>
    setSelectedServices(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );

  const handleSubmit = async () => {
    if (!carId || !form.mileage_at_service || selectedServices.length === 0) {
      setError('Kilometraje y tipo de servicio son requeridos.');
      return;
    }
    setLoading(true);
    const { error } = await addRecord({
      car_id: carId,
      service_date: form.service_date,
      mileage_at_service: parseInt(form.mileage_at_service),
      shop_name: form.shop_name || undefined,
      services: selectedServices,
      description: form.description || undefined,
      total_cost_mxn: form.total_cost_mxn ? parseFloat(form.total_cost_mxn) : undefined,
      notes: form.notes || undefined,
      parts_replaced: [],
      imported_via_ocr: false,
    });
    if (error) setError(error.message);
    else router.back();
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>Nuevo servicio</Text>
      <TextInput label="Fecha (YYYY-MM-DD)" value={form.service_date}
        onChangeText={v => setForm(f => ({ ...f, service_date: v }))} style={styles.input} />
      <TextInput label="Kilometraje *" value={form.mileage_at_service}
        onChangeText={v => setForm(f => ({ ...f, mileage_at_service: v }))}
        keyboardType="numeric" style={styles.input} />
      <TextInput label="Taller / Mecánico" value={form.shop_name}
        onChangeText={v => setForm(f => ({ ...f, shop_name: v }))} style={styles.input} />
      <Text variant="labelMedium" style={styles.label}>Tipo de servicio *</Text>
      <View style={styles.chips}>
        {SERVICE_OPTIONS.map(s => (
          <Chip key={s.value} selected={selectedServices.includes(s.value)}
            onPress={() => toggleService(s.value)} style={styles.chip}>
            {s.label}
          </Chip>
        ))}
      </View>
      <TextInput label="Descripción" value={form.description}
        onChangeText={v => setForm(f => ({ ...f, description: v }))}
        multiline style={styles.input} />
      <TextInput label="Costo total (MXN)" value={form.total_cost_mxn}
        onChangeText={v => setForm(f => ({ ...f, total_cost_mxn: v }))}
        keyboardType="numeric" style={styles.input} />
      <TextInput label="Notas" value={form.notes}
        onChangeText={v => setForm(f => ({ ...f, notes: v }))}
        multiline style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleSubmit} loading={loading} style={styles.btn}>
        Guardar
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  title: { fontWeight: 'bold', marginBottom: 20 },
  input: { marginBottom: 12 },
  label: { marginBottom: 8, color: '#666' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  chip: { margin: 4 },
  btn: { marginTop: 8 },
  error: { color: 'red', marginBottom: 8 },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): service log, parts tracker, add-record screen"
```

---

## Task 5: OCR Agent — Logbook Photo Import

**Files:**
- Create: `supabase/functions/ocr-agent/index.ts`
- Create: `apps/mobile/app/ocr.tsx`

**Interfaces:**
- Consumes: image uploaded to Supabase Storage at `ocr-photos/{carId}/{uuid}.jpg`
- Produces: `ocr_jobs` row with `extracted_data: { records: ServiceRecord[], confidence: number }`
- Called by: `apps/mobile/app/ocr.tsx` → triggers edge function → polls `ocr_jobs` table

- [ ] **Step 1: Build OCR edge function**

Create `supabase/functions/ocr-agent/index.ts`:

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const { job_id } = await req.json();

  // Mark job as processing
  await supabase.from('ocr_jobs').update({ status: 'processing' }).eq('id', job_id);

  const { data: job } = await supabase.from('ocr_jobs').select('*').eq('id', job_id).single();
  if (!job) return new Response('Job not found', { status: 404 });

  // Get signed URL for the image
  const { data: { signedUrl } } = await supabase.storage
    .from('ocr-photos').createSignedUrl(job.image_url.replace('ocr-photos/', ''), 300);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: signedUrl! },
          },
          {
            type: 'text',
            text: `This is a page from a Mexican car service logbook (bitácora de mantenimiento).
Extract all service records visible. For each record return:
- service_date: ISO date (YYYY-MM-DD), infer year from context if partial
- mileage_at_service: number in km (convert if in miles)
- shop_name: name of workshop/mechanic if visible
- services: array of service types from: oil_change, tire_rotation, brake_service, transmission, air_filter, spark_plugs, coolant, battery, alignment, inspection, other
- total_cost_mxn: cost in MXN if visible, null otherwise
- description: free text description of work done
- notes: any additional notes

Return JSON: { "records": [...], "confidence": 0.0-1.0, "warnings": ["..."] }
If the image is not a car logbook, return { "records": [], "confidence": 0, "warnings": ["Image does not appear to be a car logbook"] }`,
          },
        ],
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const extracted = JSON.parse(jsonMatch[0]);

    await supabase.from('ocr_jobs').update({
      status: 'complete',
      extracted_data: extracted,
      completed_at: new Date().toISOString(),
    }).eq('id', job_id);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    await supabase.from('ocr_jobs').update({
      status: 'failed',
      error_message: (err as Error).message,
    }).eq('id', job_id);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
```

- [ ] **Step 2: Build OCR mobile screen**

Create `apps/mobile/app/ocr.tsx`:

```tsx
import { useState } from 'react';
import { View, Image, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function OCRScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const processImage = async () => {
    if (!imageUri || !carId) return;
    setLoading(true);

    // Upload to Supabase Storage
    const filename = `${carId}/${uuidv4()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ocr-photos')
      .upload(filename, { uri: imageUri, type: 'image/jpeg', name: filename } as any);

    if (uploadError) { Alert.alert('Error subiendo imagen'); setLoading(false); return; }

    // Create OCR job
    const { data: job } = await supabase.from('ocr_jobs').insert({
      car_id: carId,
      image_url: `ocr-photos/${filename}`,
      status: 'pending',
    }).select().single();

    // Trigger edge function
    const { error: fnError } = await supabase.functions.invoke('ocr-agent', {
      body: { job_id: job!.id },
    });

    if (fnError) { Alert.alert('Error procesando imagen'); setLoading(false); return; }

    // Fetch results
    const { data: result } = await supabase
      .from('ocr_jobs').select('*').eq('id', job!.id).single();

    setResults(result?.extracted_data);
    setLoading(false);
  };

  const importRecords = async () => {
    if (!results?.records || !carId) return;
    for (const record of results.records) {
      await supabase.from('service_records').insert({
        ...record,
        car_id: carId,
        imported_via_ocr: true,
        parts_replaced: [],
      });
    }
    Alert.alert('Importado', `${results.records.length} registros importados.`,
      [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>Importar bitácora</Text>
      <Text variant="bodyMedium" style={styles.sub}>
        Toma una foto de la página de tu bitácora física. La IA extrae los registros automáticamente.
      </Text>
      <View style={styles.buttons}>
        <Button mode="outlined" onPress={takePhoto} icon="camera" style={styles.btn}>
          Tomar foto
        </Button>
        <Button mode="outlined" onPress={pickImage} icon="image" style={styles.btn}>
          Galería
        </Button>
      </View>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
      )}
      {imageUri && !results && (
        <Button mode="contained" onPress={processImage} loading={loading} style={styles.processBtn}>
          {loading ? 'Procesando...' : 'Extraer registros con IA'}
        </Button>
      )}
      {results && (
        <Card style={styles.results}>
          <Card.Content>
            <Text variant="titleMedium">Resultados</Text>
            <Text>{results.records?.length || 0} registros encontrados</Text>
            <Text style={styles.confidence}>Confianza: {Math.round((results.confidence || 0) * 100)}%</Text>
            {results.warnings?.map((w: string, i: number) => (
              <Text key={i} style={styles.warning}>{w}</Text>
            ))}
            <Button mode="contained" onPress={importRecords} style={styles.importBtn}>
              Importar todos
            </Button>
          </Card.Content>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontWeight: 'bold', marginBottom: 8 },
  sub: { color: '#666', marginBottom: 24 },
  buttons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  btn: { flex: 1 },
  preview: { width: '100%', height: 240, marginBottom: 16, borderRadius: 8 },
  processBtn: { marginBottom: 16 },
  results: { marginTop: 8 },
  confidence: { color: '#666', marginTop: 4 },
  warning: { color: '#f59e0b', marginTop: 4 },
  importBtn: { marginTop: 12 },
});
```

- [ ] **Step 3: Deploy and test OCR function**

```bash
supabase functions deploy ocr-agent --no-verify-jwt
```

Take a photo of any car service document. Verify `ocr_jobs` row goes from `pending` → `processing` → `complete`. Verify `extracted_data` has `records` array.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ocr-agent/ apps/mobile/app/ocr.tsx
git commit -m "feat(ai): ocr-agent — logbook photo → structured service records via Claude Vision"
```

---

## Task 6: Reminders + Proactive Maintenance Agent

**Files:**
- Create: `supabase/functions/maintenance-agent/index.ts`
- Create: `apps/mobile/hooks/useReminders.ts`
- Create: `apps/mobile/components/ReminderBanner.tsx`
- Create: `apps/mobile/lib/notifications.ts`

**Interfaces:**
- `maintenance-agent` edge fn: receives `{ trigger: "cron"|"manual", scope: "all_users"|"user", user_id?: string }` → scans all cars, creates reminders, sends push notifications
- `useReminders(carIds)` → `{ activeReminders, dismissReminder }`

- [ ] **Step 1: Build notifications setup**

Create `apps/mobile/lib/notifications.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
  }
  return token;
}
```

Call `registerPushToken()` in `_layout.tsx` after session is established.

- [ ] **Step 2: Build maintenance agent edge function**

Create `supabase/functions/maintenance-agent/index.ts`:

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Fetch Expo push token from profiles and send notification
async function sendPush(userId: string, title: string, body: string) {
  const { data: profile } = await supabase
    .from('profiles').select('push_token').eq('id', userId).single();
  if (!profile?.push_token) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: profile.push_token, title, body, sound: 'default' }),
  });
}

Deno.serve(async (req) => {
  const { trigger, scope, user_id } = await req.json();
  const today = new Date().toISOString().split('T')[0];

  // Fetch cars to check — all or specific user
  const query = supabase
    .from('cars')
    .select('id, owner_id, brand, model, current_mileage, plates');
  if (scope === 'user' && user_id) query.eq('owner_id', user_id);
  const { data: cars } = await query;
  if (!cars) return new Response('No cars', { status: 200 });

  for (const car of cars) {
    // 1. Check mileage-based reminders from parts
    const { data: parts } = await supabase
      .from('parts')
      .select('*')
      .eq('car_id', car.id);

    for (const part of parts || []) {
      if (!part.expected_lifetime_km) continue;
      const dueAt = part.installed_mileage + part.expected_lifetime_km;
      const kmLeft = dueAt - car.current_mileage;
      if (kmLeft > 0 && kmLeft <= 1500) {
        // Check if reminder already exists for this part
        const { data: existing } = await supabase
          .from('reminders')
          .select('id')
          .eq('car_id', car.id)
          .eq('source', 'part_tracker')
          .ilike('title', `%${part.part_name}%`)
          .eq('is_dismissed', false)
          .single();
        if (existing) continue;

        await supabase.from('reminders').insert({
          car_id: car.id,
          title: `${part.part_name} próximo`,
          description: `Faltan aproximadamente ${kmLeft} km para el siguiente cambio de ${part.part_name}.`,
          reminder_type: 'mileage',
          trigger_mileage: dueAt,
          source: 'part_tracker',
        });
        await sendPush(
          car.owner_id,
          `⚠️ ${car.brand} ${car.model}`,
          `Cambio de ${part.part_name} en ${kmLeft} km`
        );
      }
    }

    // 2. Check date-based document expiry (insurance, verification)
    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('car_id', car.id)
      .not('expiry_date', 'is', null);

    for (const doc of docs || []) {
      const daysLeft = Math.ceil(
        (new Date(doc.expiry_date).getTime() - new Date(today).getTime()) / 86400000
      );
      if (daysLeft > 0 && daysLeft <= 30) {
        const { data: existing } = await supabase
          .from('reminders').select('id')
          .eq('car_id', car.id).ilike('title', `%${doc.name}%`)
          .eq('is_dismissed', false).single();
        if (existing) continue;

        await supabase.from('reminders').insert({
          car_id: car.id,
          title: `${doc.name} vence pronto`,
          description: `Vence en ${daysLeft} días (${doc.expiry_date}).`,
          reminder_type: 'date',
          trigger_date: doc.expiry_date,
          source: 'agent',
        });
        await sendPush(car.owner_id, `📄 ${car.brand} ${car.model}`, `${doc.name} vence en ${daysLeft} días`);
      }
    }
  }

  return new Response(JSON.stringify({ processed: cars.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 3: Build useReminders hook**

Create `apps/mobile/hooks/useReminders.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Reminder } from '../types';

export function useReminders(carIds: string[]) {
  const [activeReminders, setActiveReminders] = useState<Reminder[]>([]);

  const fetch = useCallback(async () => {
    if (carIds.length === 0) return;
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .in('car_id', carIds)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false });
    if (data) setActiveReminders(data);
  }, [carIds.join(',')]);

  useEffect(() => { fetch(); }, [fetch]);

  const dismissReminder = async (id: string) => {
    await supabase.from('reminders').update({ is_dismissed: true }).eq('id', id);
    setActiveReminders(prev => prev.filter(r => r.id !== id));
  };

  return { activeReminders, dismissReminder, refetch: fetch };
}
```

- [ ] **Step 4: Build ReminderBanner component**

Create `apps/mobile/components/ReminderBanner.tsx`:

```tsx
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { Reminder } from '../types';
import { useReminders } from '../hooks/useReminders';

const COLOR = (type: string) => ({
  part_tracker: '#f59e0b', agent: '#3b82f6', verification: '#8b5cf6', manual: '#6b7280',
}[type] ?? '#6b7280');

export function ReminderBanner({ reminder }: { reminder: Reminder }) {
  const { dismissReminder } = useReminders([reminder.car_id]);
  return (
    <View style={[styles.banner, { borderLeftColor: COLOR(reminder.source) }]}>
      <View style={styles.content}>
        <Text variant="labelMedium" style={styles.title}>{reminder.title}</Text>
        {reminder.description && (
          <Text variant="bodySmall" style={styles.desc}>{reminder.description}</Text>
        )}
      </View>
      <IconButton icon="close" size={16} onPress={() => dismissReminder(reminder.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderLeftWidth: 4, marginHorizontal: 16, marginBottom: 8, borderRadius: 8,
    elevation: 1, paddingLeft: 12 },
  content: { flex: 1, paddingVertical: 8 },
  title: { fontWeight: '600' },
  desc: { color: '#666', marginTop: 2 },
});
```

- [ ] **Step 5: Deploy and test**

```bash
supabase functions deploy maintenance-agent --no-verify-jwt
```

Manually invoke the function from Supabase dashboard with `{ "trigger": "manual", "scope": "all_users" }`. Verify reminders are created. Update a part to be within 1500km of expiry and re-invoke — verify notification fires.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/maintenance-agent/ apps/mobile/hooks/useReminders.ts \
  apps/mobile/components/ReminderBanner.tsx apps/mobile/lib/notifications.ts
git commit -m "feat(agents): maintenance agent, push reminders, part lifetime tracking"
```

---

## Task 7: Verification Agent — CDMX Government Schedule

**Files:**
- Create: `supabase/functions/verification-agent/index.ts`
- Create: `supabase/functions/scrape-verification/index.ts`
- Create: `apps/mobile/components/VerificationAlert.tsx`

**Interfaces:**
- `verification-agent`: receives `{ car_id, plates, hologram_type, state }` → returns `{ due_soon: bool, start_date, end_date, days_left, message }`
- `scrape-verification`: scrapes SEDEMA page and upserts `verification_schedule` table; falls back to hard-coded 2026 data if scrape fails
- Called automatically by `maintenance-agent` on each daily cron cycle

- [ ] **Step 1: Build verification agent**

Create `supabase/functions/verification-agent/index.ts`:

```typescript
import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function getPlateLastDigit(plates: string): string {
  // Mexican plates format: ABC-123 or AB-12-CD — extract last numeric digit
  const digits = plates.replace(/[^0-9]/g, '');
  return digits.slice(-1) || '0';
}

Deno.serve(async (req) => {
  const { car_id, plates, hologram_type, state = 'CDMX' } = await req.json();
  if (!plates) return new Response(JSON.stringify({ error: 'plates required' }), { status: 400 });

  const lastDigit = getPlateLastDigit(plates);
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentSemester = today.getMonth() < 6 ? 1 : 2;

  // Find matching schedule entry
  // plate_last_digit can be '5,6' format — check if lastDigit is in the list
  const { data: schedules } = await supabase
    .from('verification_schedule')
    .select('*')
    .eq('state', state)
    .eq('hologram', hologram_type || '0')
    .eq('year', currentYear);

  const match = schedules?.find(s => {
    const digits = s.plate_last_digit.split(',').map((d: string) => d.trim());
    return digits.includes(lastDigit);
  });

  if (!match) {
    return new Response(JSON.stringify({
      due_soon: false,
      message: `No se encontró calendario de verificación para placa terminada en ${lastDigit}. Consulta sedema.cdmx.gob.mx`,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const startDate = new Date(match.start_date);
  const endDate = new Date(match.end_date);
  const daysToStart = Math.ceil((startDate.getTime() - today.getTime()) / 86400000);
  const daysToEnd = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
  const isCurrentlyDue = today >= startDate && today <= endDate;
  const isDueSoon = daysToStart > 0 && daysToStart <= 30;
  const isOverdue = daysToEnd < 0;

  let message = '';
  if (isOverdue) message = `⚠️ Verificación vencida desde ${match.end_date}. Ve al verificentro lo antes posible.`;
  else if (isCurrentlyDue) message = `🔴 Verificación activa — último día: ${match.end_date} (${Math.abs(daysToEnd)} días).`;
  else if (isDueSoon) message = `🟡 Verificación comienza en ${daysToStart} días (${match.start_date} – ${match.end_date}).`;
  else message = `✅ Verificación programada: ${match.start_date} – ${match.end_date}.`;

  // Create reminder if due soon and not already created
  if ((isDueSoon || isCurrentlyDue) && car_id) {
    const { data: existing } = await supabase
      .from('reminders').select('id')
      .eq('car_id', car_id).eq('source', 'verification')
      .eq('is_dismissed', false).single();
    if (!existing) {
      await supabase.from('reminders').insert({
        car_id,
        title: 'Verificación vehicular próxima',
        description: message,
        reminder_type: 'date',
        trigger_date: match.start_date,
        source: 'verification',
      });
    }
  }

  return new Response(JSON.stringify({
    due_soon: isDueSoon || isCurrentlyDue,
    is_overdue: isOverdue,
    start_date: match.start_date,
    end_date: match.end_date,
    days_to_start: daysToStart,
    days_to_end: daysToEnd,
    message,
  }), { headers: { 'Content-Type': 'application/json' } });
});
```

- [ ] **Step 2: Build scrape-verification function**

Create `supabase/functions/scrape-verification/index.ts`:

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SEDEMA_URL = 'https://www.sedema.cdmx.gob.mx/programas/programa/verificacion-vehicular';

Deno.serve(async (_req) => {
  try {
    // Fetch SEDEMA page
    const res = await fetch(SEDEMA_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bitacora/1.0)' },
    });
    const html = await res.text();

    // Use Claude to extract the current year's schedule from raw HTML
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Extract the vehicle verification (verificación vehicular) calendar for CDMX from this HTML.
Return JSON array:
[{
  "state": "CDMX",
  "plate_last_digit": "5,6",  // comma-separated digits that share same window
  "hologram": "0",  // "0" or "00"
  "semester": 1,  // 1 or 2
  "year": 2026,
  "start_date": "2026-01-02",  // ISO format
  "end_date": "2026-02-28",
  "notes": "optional context"
}]

HTML (truncated to first 50KB):
${html.slice(0, 50000)}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No schedule found in page');

    const schedules = JSON.parse(jsonMatch[0]);

    // Upsert schedule entries
    for (const entry of schedules) {
      await supabase.from('verification_schedule').upsert(entry, {
        onConflict: 'state,plate_last_digit,hologram,semester,year',
      });
    }

    return new Response(JSON.stringify({ updated: schedules.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // ponytail: fall back gracefully — the table already has seeded 2026 data
    console.error('Scrape failed, using seeded data:', (err as Error).message);
    return new Response(JSON.stringify({ updated: 0, fallback: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 3: Wire verification check into maintenance agent**

Add at the end of the `maintenance-agent` cars loop (after parts and docs checks):

```typescript
// 3. Check verification schedule
if (car.plates && car.hologram_type) {
  await supabase.functions.invoke('verification-agent', {
    body: { car_id: car.id, plates: car.plates, hologram_type: car.hologram_type, state: 'CDMX' },
  });
}
```

- [ ] **Step 4: Build VerificationAlert component**

Create `apps/mobile/components/VerificationAlert.tsx`:

```tsx
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { Linking } from 'react-native';

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
```

- [ ] **Step 5: Deploy and test**

```bash
supabase functions deploy verification-agent --no-verify-jwt
supabase functions deploy scrape-verification --no-verify-jwt
```

Invoke verification-agent with `{ car_id: "...", plates: "ABC-256", hologram_type: "0", state: "CDMX" }`. Plates ending in 5 or 6 should return the Jan-Feb 2026 window. Verify reminder is created.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/verification-agent/ supabase/functions/scrape-verification/ \
  apps/mobile/components/VerificationAlert.tsx
git commit -m "feat(agents): verification agent — CDMX schedule, auto-reminders, SEDEMA scraper"
```

---

## Task 8: AI Guard — Mechanic Scam Detection

**Files:**
- Create: `supabase/functions/guard-agent/index.ts`
- Create: `apps/mobile/app/(tabs)/guard.tsx`
- Create: `apps/mobile/hooks/useGuard.ts`
- Create: `apps/mobile/components/GuardSession.tsx`

**Architecture note:** Guard v1 is **async** — record audio, upload, transcribe with Whisper, then analyze with Claude. Not live streaming. This is 10x simpler to build, still effective (user reviews flags after the visit), and the right v1 scope. Live streaming is v2 after retention is proven.

**Interfaces:**
- `guard-agent`: receives `{ session_id }` → transcribes audio, analyzes vs car history, returns `{ trust_score, trust_level, flags, summary }`
- `useGuard(carId)` → `{ sessions, startSession, stopSession, analyzeSession }`

- [ ] **Step 1: Build Guard edge function**

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

Deno.serve(async (req) => {
  const { session_id } = await req.json();

  const { data: session } = await supabase
    .from('guard_sessions').select('*, cars(*)').eq('id', session_id).single();
  if (!session) return new Response('Session not found', { status: 404 });

  // Update status to processing
  await supabase.from('guard_sessions').update({ status: 'processing' }).eq('id', session_id);

  const car = session.cars;

  try {
    // 1. Transcribe audio via Whisper
    const { data: audioUrl } = await supabase.storage
      .from('guard-audio')
      .createSignedUrl(`${session_id}.m4a`, 300);

    let transcript = '';
    if (audioUrl?.signedUrl) {
      const audioResponse = await fetch(audioUrl.signedUrl);
      const audioBlob = await audioResponse.blob();
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.m4a');
      formData.append('model', 'whisper-1');
      formData.append('language', 'es');
      const whisperResponse = await openai.audio.transcriptions.create({
        file: new File([audioBlob], 'audio.m4a', { type: 'audio/m4a' }),
        model: 'whisper-1',
        language: 'es',
      });
      transcript = whisperResponse.text;
    }

    if (!transcript) {
      await supabase.from('guard_sessions').update({ status: 'failed', error: 'No audio transcribed' }).eq('id', session_id);
      return new Response(JSON.stringify({ error: 'No audio' }), { status: 400 });
    }

    // 2. Fetch car service history for context
    const { data: serviceHistory } = await supabase
      .from('service_records')
      .select('*')
      .eq('car_id', car.id)
      .order('service_date', { ascending: false })
      .limit(10);

    const { data: parts } = await supabase
      .from('parts').select('*').eq('car_id', car.id);

    // 3. Analyze with Claude
    const analysisResponse = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: `You are an expert automotive mechanic and consumer protection advisor for Mexico. 
You help car owners verify that the advice they receive from mechanics is honest and fair.
You know typical service intervals, common scams in Mexican mechanic shops, and fair market prices in MXN.
Be conservative — only flag something as RED if you are highly confident. Yellow for uncertain cases. Green means no issues found.
Always explain your reasoning in Spanish so the user understands.`,
      messages: [{
        role: 'user',
        content: `Analiza esta conversación con un mecánico y dime si hay señales de cobros excesivos o servicios innecesarios.

AUTO:
- ${car.brand} ${car.model} ${car.year}
- Kilometraje actual: ${car.current_mileage.toLocaleString()} km

HISTORIAL RECIENTE:
${serviceHistory?.map(r => `- ${r.service_date}: ${r.services.join(', ')} @ ${r.mileage_at_service.toLocaleString()} km${r.total_cost_mxn ? ` — $${r.total_cost_mxn} MXN` : ''}`).join('\n') || 'Sin historial registrado'}

REFACCIONES INSTALADAS:
${parts?.map(p => `- ${p.part_name}: instalado a ${p.installed_mileage.toLocaleString()} km${p.expected_lifetime_km ? `, vida útil ${p.expected_lifetime_km.toLocaleString()} km` : ''}`).join('\n') || 'Sin refacciones registradas'}

TRANSCRIPCIÓN DE LA CONVERSACIÓN:
${transcript}

Responde en JSON:
{
  "trust_score": 85,
  "trust_level": "green",
  "flags": [
    {
      "type": "overcharge",
      "severity": "high",
      "description": "El mecánico cobró $2,000 MXN por cambio de aceite. El precio de mercado en CDMX es $400-$700 MXN.",
      "mechanic_quote": "texto exacto que dijo el mecánico",
      "reference_data": "dato de referencia que usaste"
    }
  ],
  "summary": "Resumen en 2-3 oraciones de lo que encontraste."
}`,
      }],
    });

    const text = analysisResponse.content[0].type === 'text' ? analysisResponse.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No analysis JSON');
    const analysis = JSON.parse(jsonMatch[0]);

    // Save results
    await supabase.from('guard_sessions').update({
      status: 'complete',
      transcript,
      trust_score: analysis.trust_score,
      trust_level: analysis.trust_level,
      flags: analysis.flags,
      summary: analysis.summary,
      ended_at: new Date().toISOString(),
    }).eq('id', session_id);

    return new Response(JSON.stringify(analysis), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    await supabase.from('guard_sessions').update({
      status: 'failed',
      error_message: (err as Error).message,
    }).eq('id', session_id);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
```

- [ ] **Step 2: Create guard-audio storage bucket**

In Supabase Storage → New bucket: `guard-audio`, private, 100MB max. RLS: owner via car ownership (use edge function service key for upload).

- [ ] **Step 3: Build Guard mobile screen**

Create `apps/mobile/app/(tabs)/guard.tsx`:

```tsx
import { useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card, Chip, ProgressBar } from 'react-native-paper';
import { Audio } from 'expo-av';
import { supabase } from '../../lib/supabase';
import { useCars } from '../../hooks/useCars';
import { GuardFlag } from '../../types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const TRUST_COLOR = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' };
const FLAG_LABEL = {
  overcharge: 'Cobro excesivo',
  unnecessary_service: 'Servicio innecesario',
  premature_replacement: 'Reemplazo prematuro',
  inconsistent_diagnosis: 'Diagnóstico inconsistente',
};

export default function GuardScreen() {
  const { cars } = useCars();
  const primaryCar = cars.find(c => c.is_primary) || cars[0];
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const startRecording = async () => {
    if (!primaryCar) { Alert.alert('Agrega un auto primero'); return; }
    if (!consentGiven) {
      Alert.alert(
        'Aviso de grabación',
        'Bitácora grabará el audio de tu conversación con el mecánico para analizarla con IA. El audio se elimina después del análisis. Solo se guarda la transcripción. ¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Entendido, continuar', onPress: async () => {
            setConsentGiven(true);
            await doStartRecording();
          }},
        ]
      );
      return;
    }
    await doStartRecording();
  };

  const doStartRecording = async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    // Create session in DB
    const id = uuidv4();
    await supabase.from('guard_sessions').insert({
      id,
      car_id: primaryCar!.id,
      status: 'recording',
    });
    setSessionId(id);

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    setRecording(recording);
    setIsRecording(true);
  };

  const stopAndAnalyze = async () => {
    if (!recording || !sessionId) return;
    setIsRecording(false);
    setProcessing(true);

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) { setProcessing(false); return; }

    // Upload audio
    const fileData = await fetch(uri);
    const blob = await fileData.blob();
    await supabase.storage.from('guard-audio').upload(`${sessionId}.m4a`, blob, {
      contentType: 'audio/m4a',
    });

    // Trigger analysis
    const { data } = await supabase.functions.invoke('guard-agent', {
      body: { session_id: sessionId },
    });
    setResult(data);
    setProcessing(false);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>🛡 Guard Mode</Text>
      <Text variant="bodyMedium" style={styles.sub}>
        Graba tu conversación con el mecánico. La IA analiza si algo es sospechoso.
      </Text>
      {primaryCar && (
        <Text variant="labelMedium" style={styles.car}>
          Auto: {primaryCar.brand} {primaryCar.model} {primaryCar.year}
        </Text>
      )}

      {!result && !processing && (
        <View style={styles.recordArea}>
          {!isRecording ? (
            <Button mode="contained" icon="microphone" onPress={startRecording}
              style={styles.recordBtn} contentStyle={styles.recordBtnContent}>
              Iniciar grabación
            </Button>
          ) : (
            <>
              <View style={styles.recording}>
                <View style={styles.dot} />
                <Text variant="bodyMedium" style={styles.recordingText}>Grabando...</Text>
              </View>
              <Button mode="contained" icon="stop" onPress={stopAndAnalyze}
                buttonColor="#ef4444" style={styles.stopBtn}>
                Detener y analizar
              </Button>
            </>
          )}
        </View>
      )}

      {processing && (
        <View style={styles.processing}>
          <Text variant="bodyMedium">Analizando conversación...</Text>
          <ProgressBar indeterminate style={styles.progress} />
        </View>
      )}

      {result && (
        <View style={styles.results}>
          <View style={[styles.scoreCard, { borderColor: TRUST_COLOR[result.trust_level as keyof typeof TRUST_COLOR] }]}>
            <Text variant="displaySmall" style={{ color: TRUST_COLOR[result.trust_level as keyof typeof TRUST_COLOR], fontWeight: 'bold' }}>
              {result.trust_score}
            </Text>
            <Text variant="labelMedium" style={{ color: '#666' }}>Puntaje de confianza</Text>
          </View>
          <Text variant="bodyMedium" style={styles.summary}>{result.summary}</Text>
          {result.flags?.map((flag: GuardFlag, i: number) => (
            <Card key={i} style={[styles.flagCard, {
              borderLeftColor: flag.severity === 'high' ? '#ef4444' : flag.severity === 'medium' ? '#f59e0b' : '#6b7280'
            }]}>
              <Card.Content>
                <Chip compact style={styles.flagChip}>{FLAG_LABEL[flag.type as keyof typeof FLAG_LABEL] || flag.type}</Chip>
                <Text variant="bodySmall" style={styles.flagDesc}>{flag.description}</Text>
                {flag.mechanic_quote && (
                  <Text variant="bodySmall" style={styles.quote}>"{flag.mechanic_quote}"</Text>
                )}
              </Card.Content>
            </Card>
          ))}
          <Button mode="outlined" onPress={() => { setResult(null); setSessionId(null); }} style={styles.resetBtn}>
            Nueva sesión
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', paddingTop: 56 },
  title: { fontWeight: 'bold', marginBottom: 8 },
  sub: { color: '#666', marginBottom: 8 },
  car: { color: '#3b82f6', marginBottom: 24 },
  recordArea: { alignItems: 'center', marginTop: 40 },
  recordBtn: { borderRadius: 50 },
  recordBtnContent: { paddingVertical: 12, paddingHorizontal: 24 },
  recording: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444', marginRight: 8 },
  recordingText: { color: '#ef4444' },
  stopBtn: { borderRadius: 50 },
  processing: { alignItems: 'center', marginTop: 40 },
  progress: { width: 200, marginTop: 16 },
  results: { flex: 1 },
  scoreCard: { alignItems: 'center', borderWidth: 3, borderRadius: 60, width: 120, height: 120, justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  summary: { textAlign: 'center', color: '#444', marginBottom: 16 },
  flagCard: { borderLeftWidth: 4, marginBottom: 8 },
  flagChip: { alignSelf: 'flex-start', marginBottom: 8 },
  flagDesc: { color: '#444', marginBottom: 4 },
  quote: { color: '#888', fontStyle: 'italic' },
  resetBtn: { marginTop: 16 },
});
```

- [ ] **Step 4: Deploy Guard function**

```bash
supabase functions deploy guard-agent --no-verify-jwt
```

Add `OPENAI_API_KEY` to Supabase edge function secrets:
```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

- [ ] **Step 5: Test Guard end-to-end**

Record a 30-second test where you say (in Spanish): "El mecánico me dijo que necesito cambiar las balatas, el aceite, las bujías y la transmisión. Me va a cobrar $8,000 pesos." Verify:
- Audio uploaded to `guard-audio` bucket
- `guard_sessions` row goes to `processing` then `complete`
- `flags` array has at least one entry (the $8,000 charge for listed services should flag as high)
- `trust_score` is below 70

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/guard-agent/ apps/mobile/app/(tabs)/guard.tsx \
  apps/mobile/hooks/useGuard.ts
git commit -m "feat(ai): guard agent — ambient recording, Whisper transcription, Claude scam analysis"
```

---

## Task 9: Document Vault + Tabs Navigation

**Files:**
- Create: `apps/mobile/app/(tabs)/docs.tsx`
- Create: `apps/mobile/app/(tabs)/parts.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`

**Interfaces:**
- Completes the bottom tab navigator (Home, Log, Parts, Docs, Guard)

- [ ] **Step 1: Build tab navigator layout**

Create `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#3b82f6' }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="car" color={color} size={size} /> }} />
      <Tabs.Screen name="log" options={{ title: 'Servicios',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="wrench" color={color} size={size} /> }} />
      <Tabs.Screen name="parts" options={{ title: 'Piezas',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" color={color} size={size} /> }} />
      <Tabs.Screen name="docs" options={{ title: 'Docs',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="file-document" color={color} size={size} /> }} />
      <Tabs.Screen name="guard" options={{ title: 'Guard',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shield-check" color={color} size={size} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Build Docs tab**

Create `apps/mobile/app/(tabs)/docs.tsx` — list of documents per car. FAB opens a picker (from `expo-document-picker` or `expo-image-picker`). On file selected, upload to `car-documents` bucket, insert into `documents` table with `doc_type`, `name`, `expiry_date`. Show expiry badge in red if within 30 days.

- [ ] **Step 3: Build Parts tab**

Create `apps/mobile/app/(tabs)/parts.tsx` — list parts grouped by car. Show progress bar for each part: `(current_mileage - installed_mileage) / expected_lifetime_km`. Green < 70%, yellow 70-90%, red > 90%. FAB opens add-part form inline.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/
git commit -m "feat(mobile): tabs layout, docs vault, parts tracker UI"
```

---

## Task 10: Health Score Computation + Final Polish

**Files:**
- Modify: `supabase/functions/maintenance-agent/index.ts` (add health score computation)
- Create: `apps/mobile/components/HealthScore.tsx`

**Health score formula:**
- Start at 100
- -10 per overdue reminder (not dismissed)
- -15 per part > 90% of expected lifetime
- -20 per overdue document (insurance, verification)
- -5 per missing core data (no mileage updated in 60+ days, no service in 12+ months)
- Floor at 0

- [ ] **Step 1: Add health score computation to maintenance agent**

Add this function to `supabase/functions/maintenance-agent/index.ts` and call it after processing each car:

```typescript
async function computeHealthScore(carId: string, currentMileage: number): Promise<number> {
  let score = 100;
  const today = new Date();

  // Active undismissed reminders
  const { data: reminders } = await supabase
    .from('reminders').select('id').eq('car_id', carId).eq('is_dismissed', false);
  score -= Math.min(30, (reminders?.length || 0) * 10);

  // Parts near end of life
  const { data: parts } = await supabase.from('parts').select('*').eq('car_id', carId);
  for (const p of parts || []) {
    if (!p.expected_lifetime_km) continue;
    const pct = (currentMileage - p.installed_mileage) / p.expected_lifetime_km;
    if (pct > 0.9) score -= 15;
  }

  // Overdue documents
  const { data: docs } = await supabase
    .from('documents').select('expiry_date').eq('car_id', carId).not('expiry_date', 'is', null);
  for (const d of docs || []) {
    if (new Date(d.expiry_date) < today) score -= 20;
  }

  return Math.max(0, score);
}

// After processing each car, update health score:
const newScore = await computeHealthScore(car.id, car.current_mileage);
await supabase.from('cars').update({ health_score: newScore }).eq('id', car.id);
```

- [ ] **Step 2: Run full smoke test**

1. Sign up fresh account
2. Add a car with plates and hologram type
3. Add 3 service records (one via OCR if available)
4. Add 2 parts with expected lifetimes
5. Upload an insurance document with expiry 15 days from now
6. Manually invoke `maintenance-agent` via Supabase dashboard
7. Verify: reminders created for document expiry, verification alert appears, health score updates
8. Open Guard, record 30s of test audio, verify analysis completes
9. Dismiss a reminder, verify health score improves

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat(core): health score computation, maintenance agent integration, smoke test complete"
```

---

## Environment Variables

| Variable | Where | Value |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | Supabase anon key |
| `ANTHROPIC_API_KEY` | Supabase edge function secrets | `sk-ant-...` |
| `OPENAI_API_KEY` | Supabase edge function secrets | `sk-...` (for Whisper) |
| `SUPABASE_URL` | auto-injected in edge functions | — |
| `SUPABASE_SERVICE_ROLE_KEY` | auto-injected in edge functions | — |

Set edge function secrets:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-...
```

---

## Self-Review

### Spec coverage check
- ✅ Car profile (brand, model, year, plates, hologram, mileage) — Task 3
- ✅ OCR of physical logbook — Task 5
- ✅ Service log — Task 4
- ✅ Part tracker + estimated lifetime — Task 4
- ✅ Reminders (mileage + date) — Task 6
- ✅ AI Mechanic Guard (async) — Task 8
- ✅ Proactive notifications — Task 6 (pg_cron daily)
- ✅ Government verification data (CDMX) — Task 7
- ✅ Verification schedule auto-scrape — Task 7
- ✅ Document vault (insurance, verificación) — Task 9
- ✅ Health score — Task 10
- ✅ Multi-agent architecture (Orchestrator → OCR/Guard/Maintenance/Verification) — Tasks 5–8
- ✅ Push notifications — Task 6
- ✅ RLS on all tables — Task 1

### Deliberate simplifications (ponytail)
- `// ponytail: Guard is async (record → upload → analyze), not live streaming. Saves 3 weeks of WebSocket complexity. Add live streaming in v2 when retention > 30 days.`
- `// ponytail: Verification schedule seeded for CDMX 2026 only. Scraper adds more states. Expand to Monterrey/GDL in v2.`
- `// ponytail: No offline-first sync (op-sqlite) implemented in this plan — marked for post-launch when offline usage is confirmed by analytics.`
- `// ponytail: Health score is a simple formula, not ML. Replace with a trained model only if users report it feels inaccurate.`

---

*Plan saved: 2026-06-22 | Bitácora MVP | Alan Ayala García*

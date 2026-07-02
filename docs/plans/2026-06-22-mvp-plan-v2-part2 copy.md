# Bitácora MVP Plan v2 — Part 2: Core Features

*(Continues from part1. Tasks 4–9.)*

---

## Task 4: Car Profile — Add + List + useSubscription

**Files:**
- Create: `apps/mobile/hooks/useCars.ts`
- Create: `apps/mobile/hooks/useSubscription.ts`
- Create: `apps/mobile/components/CarCard.tsx`
- Create: `apps/mobile/components/PaywallGate.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/app/car/add.tsx`

**Consumer insight:** First car add must feel like an achievement, not a form. Pre-populate common Mexican car brands as a scrollable picker. Show "Tu auto está protegido ✓" immediately after adding — this is operant conditioning: the reward reinforces the action.

- [ ] **Step 1: Build useCars hook**

Create `apps/mobile/hooks/useCars.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Car } from '../types';

export function useCars() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('cars').select('*')
      .order('is_primary', { ascending: false })
      .order('created_at');
    if (data) setCars(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const addCar = async (car: Omit<Car, 'id' | 'owner_id' | 'health_score' | 'display_name' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('cars')
      .insert({ ...car, owner_id: user!.id })
      .select().single();
    if (!error && data) setCars(prev => [...prev, data]);
    return { data, error };
  };

  const updateCar = async (id: string, updates: Partial<Car>) => {
    const { data, error } = await supabase.from('cars')
      .update(updates).eq('id', id).select().single();
    if (!error && data) setCars(prev => prev.map(c => c.id === id ? data : c));
    return { data, error };
  };

  const updateMileage = (id: string, km: number) => updateCar(id, { current_mileage: km });
  const deleteCar = async (id: string) => {
    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (!error) setCars(prev => prev.filter(c => c.id !== id));
    return { error };
  };

  return { cars, loading, addCar, updateCar, updateMileage, deleteCar, refetch: fetch };
}
```

- [ ] **Step 2: Build useSubscription hook**

Create `apps/mobile/hooks/useSubscription.ts`:
```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Subscription, Profile } from '../types';

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [{ data: sub }, { data: prof }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
      ]);
      setSubscription(sub);
      setProfile(prof);
      setLoading(false);
    })();
  }, []);

  const isPro = subscription?.plan === 'pro' || subscription?.plan === 'pro_guard';
  const hasGuard = subscription?.plan === 'pro_guard';
  const freeGuardLeft = profile?.free_guard_sessions_remaining ?? 0;
  const canUseGuard = hasGuard || freeGuardLeft > 0;

  return { subscription, profile, loading, isPro, hasGuard, canUseGuard, freeGuardLeft };
}
```

- [ ] **Step 3: Build PaywallGate component**

Create `apps/mobile/components/PaywallGate.tsx`:
```tsx
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { Copy } from '../constants/copy';
import { useSubscription } from '../hooks/useSubscription';

interface Props {
  feature: 'guard' | 'pro';
  children: React.ReactNode;
}

export function PaywallGate({ feature, children }: Props) {
  const { canUseGuard, freeGuardLeft, hasGuard } = useSubscription();

  if (feature === 'guard' && !canUseGuard) {
    return (
      <View style={styles.wall}>
        <Text style={styles.icon}>🛡</Text>
        <Text style={[Typography.title, { textAlign: 'center' }]}>{Copy.paywallHeadline}</Text>
        <Text style={[Typography.body, styles.sub]}>{Copy.paywallSub}</Text>
        <View style={styles.mathBox}>
          <Text style={[Typography.label, { color: Colors.accent }]}>{Copy.paywallMath}</Text>
        </View>
        <Button mode="contained" style={styles.cta} onPress={() => router.push('/paywall')}>
          {Copy.paywallCta}
        </Button>
      </View>
    );
  }

  // Show free session counter if applicable
  if (feature === 'guard' && freeGuardLeft > 0 && !hasGuard) {
    // Render children but show usage banner above
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.freeBanner}>
          <Text style={[Typography.caption, { color: Colors.warning }]}>
            {freeGuardLeft} sesión{freeGuardLeft !== 1 ? 'es' : ''} gratis restante{freeGuardLeft !== 1 ? 's' : ''}
          </Text>
        </View>
        {children}
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  wall: { flex: 1, padding: Spacing.xl, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  icon: { fontSize: 64, marginBottom: Spacing.lg },
  sub: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  mathBox: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.xl, borderLeftWidth: 4, borderLeftColor: Colors.accent },
  cta: { borderRadius: 50, width: '100%' },
  freeBanner: { backgroundColor: '#FEF9C3', padding: Spacing.sm, alignItems: 'center' },
});
```

- [ ] **Step 4: Build CarCard component**

Create `apps/mobile/components/CarCard.tsx`:
```tsx
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { Car } from '../types';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

const healthColor = (s: number) => s >= 80 ? Colors.accent : s >= 50 ? Colors.warning : Colors.danger;
const healthLabel = (s: number) => s >= 80 ? 'Excelente' : s >= 50 ? 'Regular' : 'Atención';

export function CarCard({ car }: { car: Car }) {
  const color = healthColor(car.health_score);
  return (
    <TouchableOpacity onPress={() => router.push(`/car/${car.id}`)} activeOpacity={0.8}>
      <View style={styles.card}>
        <View style={styles.left}>
          <Text style={[Typography.title, { marginBottom: 2 }]}>{car.display_name || `${car.brand} ${car.model}`}</Text>
          <Text style={Typography.label}>
            {car.year} · {car.plates ?? 'Sin placas'} · {car.current_mileage.toLocaleString('es-MX')} km
          </Text>
        </View>
        <View style={[styles.badge, { borderColor: color }]}>
          <Text style={[Typography.title, { color, lineHeight: 22 }]}>{car.health_score}</Text>
          <Text style={[Typography.caption, { color }]}>{healthLabel(car.health_score)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  left: { flex: 1, marginRight: Spacing.md },
  badge: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 5: Build Add Car screen**

Create `apps/mobile/app/car/add.tsx`:

```tsx
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons, Menu } from 'react-native-paper';
import { useCars } from '../../hooks/useCars';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

// Top 20 car brands in Mexico by sales (AMDA 2024)
const MX_BRANDS = ['Nissan', 'General Motors', 'KIA', 'Toyota', 'Volkswagen', 'Stellantis',
  'Ford', 'Honda', 'Hyundai', 'Mazda', 'Suzuki', 'Audi', 'BMW', 'Mercedes-Benz',
  'Seat', 'Jeep', 'RAM', 'Chevrolet', 'Acura', 'Infiniti'];

export default function AddCarScreen() {
  const { addCar } = useCars();
  const [brand, setBrand] = useState('');
  const [brandMenuVisible, setBrandMenuVisible] = useState(false);
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [nickname, setNickname] = useState('');
  const [plates, setPlates] = useState('');
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('0');
  const [hologram, setHologram] = useState<'0' | '00' | 'exento'>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!brand || !model || !year) { setError('Marca, modelo y año son requeridos.'); return; }
    setLoading(true);
    const { error } = await addCar({
      brand, model, year: parseInt(year), nickname: nickname || undefined,
      plates: plates || undefined, vin: vin || undefined,
      fuel_type: 'gasoline', current_mileage: parseInt(mileage) || 0,
      hologram_type: hologram, is_primary: false,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  };

  // Success state — operant reward
  if (done) {
    return (
      <View style={styles.success}>
        <Text style={{ fontSize: 72 }}>✅</Text>
        <Text style={[Typography.heading, { textAlign: 'center', marginTop: Spacing.lg }]}>
          Tu {brand} {model} está protegido.
        </Text>
        <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
          Bitácora ya está monitoreando tu auto.
        </Text>
        <Button mode="contained" style={styles.doneBtn} onPress={() => router.replace('/(tabs)/')}>
          Ver mi auto
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[Typography.heading, { marginBottom: Spacing.lg }]}>Agregar auto</Text>

      {/* Brand picker */}
      <Menu visible={brandMenuVisible} onDismiss={() => setBrandMenuVisible(false)}
        anchor={
          <TextInput label="Marca *" value={brand} onFocus={() => setBrandMenuVisible(true)}
            right={<TextInput.Icon icon="chevron-down" />} style={styles.input} />
        }>
        {MX_BRANDS.map(b => (
          <Menu.Item key={b} title={b} onPress={() => { setBrand(b); setBrandMenuVisible(false); }} />
        ))}
      </Menu>

      <TextInput label="Modelo *" value={model} onChangeText={setModel} style={styles.input} />
      <TextInput label="Año *" value={year} onChangeText={setYear} keyboardType="numeric" style={styles.input} />
      <TextInput label="Apodo (ej. 'La Viejita')" value={nickname} onChangeText={setNickname} style={styles.input} />
      <TextInput label="Placas" value={plates} onChangeText={p => setPlates(p.toUpperCase())} autoCapitalize="characters" style={styles.input} />
      <TextInput label="VIN (opcional)" value={vin} onChangeText={setVin} style={styles.input} />
      <TextInput label="Kilometraje actual" value={mileage} onChangeText={setMileage} keyboardType="numeric" style={styles.input} />

      <Text style={[Typography.label, { marginBottom: Spacing.sm }]}>Tipo de holograma</Text>
      <SegmentedButtons value={hologram} onValueChange={v => setHologram(v as typeof hologram)}
        buttons={[
          { value: '0', label: 'Holograma 0' },
          { value: '00', label: 'Holograma 00' },
          { value: 'exento', label: 'Exento' },
        ]} style={{ marginBottom: Spacing.lg }} />

      <View style={styles.holoHelper}>
        <Text style={Typography.caption}>
          ¿No sabes tu holograma? Está en el engomado de verificación de tu parabrisas. Holograma 0 = verificas cada 6 meses. Holograma 00 = cada año. Exento = sin verificación.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleSubmit} loading={loading} style={styles.btn}>
        Guardar auto
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.xl },
  input: { marginBottom: Spacing.sm },
  holoHelper: { backgroundColor: Colors.background, borderRadius: 8, padding: Spacing.sm, marginBottom: Spacing.lg },
  btn: { borderRadius: 50, marginTop: Spacing.sm },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
  success: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface },
  doneBtn: { borderRadius: 50, marginTop: Spacing.xl, width: '100%' },
});
```

- [ ] **Step 6: Build Home tab**

Create `apps/mobile/app/(tabs)/index.tsx`:
```tsx
import { View, FlatList, StyleSheet } from 'react-native';
import { FAB, Text, ActivityIndicator } from 'react-native-paper';
import { useCars } from '../../hooks/useCars';
import { useReminders } from '../../hooks/useReminders';
import { CarCard } from '../../components/CarCard';
import { ReminderBanner } from '../../components/ReminderBanner';
import { EmptyState } from '../../components/EmptyState';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

export default function HomeScreen() {
  const { cars, loading } = useCars();
  const { activeReminders } = useReminders(cars.map(c => c.id));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Mis autos</Text>
      {activeReminders.slice(0, 3).map(r => <ReminderBanner key={r.id} reminder={r} />)}
      <FlatList
        data={cars}
        keyExtractor={c => c.id}
        renderItem={({ item }) => <CarCard car={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="🚗"
            title="Sin autos registrados"
            body="Agrega tu primer auto y empieza a protegerlo."
            quote={null}
          />
        }
      />
      <FAB icon="plus" style={styles.fab} color={Colors.surface}
        customSize={56} onPress={() => router.push('/car/add')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.md, backgroundColor: Colors.primary },
});
```

- [ ] **Step 7: EmptyState with social proof**

Create `apps/mobile/components/EmptyState.tsx`:
```tsx
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
  const q = quote ?? SOCIAL_QUOTES[Math.floor(Math.random() * SOCIAL_QUOTES.length)];
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
```

- [ ] **Step 8: Commit**
```bash
git add apps/mobile/
git commit -m "feat(mobile): car profile, CarCard, home tab, PaywallGate, EmptyState with social proof"
```

---

## Task 5: Service Log + Parts Tracker

*(Hooks and screens — abbreviated since logic matches v1. Key changes below.)*

**Files:** `hooks/useServiceLog.ts`, `hooks/useParts.ts`, `app/(tabs)/log.tsx`, `app/(tabs)/parts.tsx`, `app/log/add.tsx`, `components/ServiceChip.tsx`

- [ ] **Step 1: Build hooks** — copy `useServiceLog` and `useParts` from v1 plan verbatim. No changes needed.

- [ ] **Step 2: Build ServiceChip component**

Create `apps/mobile/components/ServiceChip.tsx`:
```tsx
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { ServiceType } from '../types';
import { Colors } from '../constants/colors';

const SERVICE_LABELS: Record<ServiceType, string> = {
  oil_change: 'Aceite', tire_rotation: 'Llantas', brake_service: 'Frenos',
  transmission: 'Transmisión', air_filter: 'Filtro aire', spark_plugs: 'Bujías',
  coolant: 'Anticongelante', battery: 'Batería', alignment: 'Alineación',
  inspection: 'Revisión', other: 'Otro',
};

export function ServiceChip({ type, selected, onPress }: { type: ServiceType; selected: boolean; onPress?: () => void }) {
  return (
    <Chip selected={selected} onPress={onPress} compact
      selectedColor={Colors.primary}
      style={[styles.chip, selected && styles.selected]}>
      {SERVICE_LABELS[type]}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: { margin: 4 },
  selected: { backgroundColor: '#EFF6FF' },
});
```

- [ ] **Step 3: Build Parts tab (health visualization)**

Create `apps/mobile/app/(tabs)/parts.tsx`:
```tsx
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, ProgressBar, FAB, Card } from 'react-native-paper';
import { useParts } from '../../hooks/useParts';
import { useCars } from '../../hooks/useCars';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { EmptyState } from '../../components/EmptyState';
import { Part } from '../../types';

function PartRow({ part, currentMileage }: { part: Part; currentMileage: number }) {
  const pct = part.expected_lifetime_km
    ? Math.min(1, (currentMileage - part.installed_mileage) / part.expected_lifetime_km)
    : 0;
  const color = pct < 0.7 ? Colors.accent : pct < 0.9 ? Colors.warning : Colors.danger;
  const kmLeft = part.expected_lifetime_km
    ? Math.max(0, part.installed_mileage + part.expected_lifetime_km - currentMileage)
    : null;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.partHeader}>
          <Text style={Typography.label}>{part.part_name}</Text>
          {kmLeft !== null && (
            <Text style={[Typography.caption, { color }]}>
              {kmLeft > 0 ? `${kmLeft.toLocaleString('es-MX')} km restantes` : 'Vencida'}
            </Text>
          )}
        </View>
        {part.expected_lifetime_km && (
          <ProgressBar progress={pct} color={color} style={styles.bar} />
        )}
        <Text style={Typography.caption}>
          Instalada: {part.installed_date} @ {part.installed_mileage.toLocaleString('es-MX')} km
        </Text>
      </Card.Content>
    </Card>
  );
}

export default function PartsScreen() {
  const { cars } = useCars();
  const primary = cars[0];
  const { parts } = useParts(primary?.id);

  if (!primary) return <EmptyState icon="🔧" title="Sin auto registrado" body="Agrega un auto primero." quote={null} />;

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, styles.header]}>Piezas — {primary.display_name}</Text>
      <FlatList
        data={parts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PartRow part={item} currentMileage={primary.current_mileage} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="⚙️" title="Sin piezas registradas"
            body="Agrega las piezas reemplazadas para saber cuándo toca el próximo cambio." quote={null} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 80 },
  card: { marginBottom: Spacing.sm, borderRadius: 12 },
  partHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  bar: { height: 6, borderRadius: 3, marginBottom: Spacing.xs },
});
```

- [ ] **Step 4: Commit**
```bash
git add apps/mobile/
git commit -m "feat(mobile): service log, parts tracker, ServiceChip, PartRow health bar"
```

---

## Task 6: OCR Agent — Logbook Photo Import

*(Edge function same as v1. Mobile screen same. No consumer-driven changes — this is a utility feature, low involvement, should just work.)*

- [ ] Deploy `supabase/functions/ocr-agent/index.ts` — verbatim from v1 plan
- [ ] Build `apps/mobile/app/ocr.tsx` — verbatim from v1 plan
- [ ] Commit: `feat(ai): ocr-agent — logbook photo to service records via Claude Vision`

---

## Task 7: Maintenance Agent + Reminders (Approach-Framed Notifications)

**Files:**
- Create: `supabase/functions/maintenance-agent/index.ts`
- Create: `apps/mobile/hooks/useReminders.ts`
- Create: `apps/mobile/components/ReminderBanner.tsx`

**Consumer insight:** All notification copy uses **Approach framing** (positive outcomes, car-specific). Never "Your oil change is overdue" — always "Tu Nissan tiene cambio de aceite en 1,500 km ⚡". The car's name/brand is in every notification. Personalization increases open rate and reduces perceptual blocking.

- [ ] **Step 1: Build useReminders hook** — verbatim from v1, no changes.

- [ ] **Step 2: Build maintenance agent edge function**

Create `supabase/functions/maintenance-agent/index.ts`:

```typescript
import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function sendPush(userId: string, title: string, body: string) {
  const { data: p } = await supabase.from('profiles').select('push_token').eq('id', userId).single();
  if (!p?.push_token) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: p.push_token, title, body, sound: 'default' }),
  });
}

// Approach-framed reminder titles using car display name
function partReminderTitle(carName: string, partName: string): string {
  return `Tu ${carName} tiene ${partName} próximamente`;
}
function partReminderBody(partName: string, kmLeft: number): string {
  return `Cambio de ${partName} en ${kmLeft.toLocaleString('es-MX')} km. Programa tu visita con tiempo.`;
}
function docReminderTitle(carName: string): string {
  return `Protege tu familia — ${carName}`;
}
function docReminderBody(docName: string, days: number): string {
  return `${docName} vence en ${days} días. Renuévalo antes de que sea urgente.`;
}

async function computeHealthScore(carId: string, currentMileage: number): Promise<number> {
  let score = 100;
  const today = new Date();

  const { data: reminders } = await supabase
    .from('reminders').select('id').eq('car_id', carId).eq('is_dismissed', false);
  score -= Math.min(30, (reminders?.length ?? 0) * 10);

  const { data: parts } = await supabase.from('parts').select('*').eq('car_id', carId);
  for (const p of parts ?? []) {
    if (!p.expected_lifetime_km) continue;
    if ((currentMileage - p.installed_mileage) / p.expected_lifetime_km > 0.9) score -= 15;
  }

  const { data: docs } = await supabase.from('documents')
    .select('expiry_date').eq('car_id', carId).not('expiry_date', 'is', null);
  for (const d of docs ?? []) {
    if (new Date(d.expiry_date) < today) score -= 20;
  }

  return Math.max(0, score);
}

Deno.serve(async (req) => {
  const { scope, user_id } = await req.json();
  const today = new Date().toISOString().split('T')[0];

  const query = supabase.from('cars').select('id, owner_id, brand, model, display_name, current_mileage, plates, hologram_type');
  if (scope === 'user' && user_id) query.eq('owner_id', user_id);
  const { data: cars } = await query;
  if (!cars?.length) return new Response('ok', { status: 200 });

  for (const car of cars) {
    const carName = car.display_name || `${car.brand} ${car.model}`;

    // 1. Part-based mileage reminders
    const { data: parts } = await supabase.from('parts').select('*').eq('car_id', car.id);
    for (const part of parts ?? []) {
      if (!part.expected_lifetime_km) continue;
      const dueAt = part.installed_mileage + part.expected_lifetime_km;
      const kmLeft = dueAt - car.current_mileage;
      if (kmLeft > 0 && kmLeft <= 1500) {
        const { data: existing } = await supabase.from('reminders').select('id')
          .eq('car_id', car.id).eq('source', 'part_tracker').ilike('title', `%${part.part_name}%`)
          .eq('is_dismissed', false).maybeSingle();
        if (existing) continue;
        await supabase.from('reminders').insert({
          car_id: car.id,
          title: partReminderTitle(carName, part.part_name),
          description: partReminderBody(part.part_name, kmLeft),
          reminder_type: 'mileage',
          trigger_mileage: dueAt,
          source: 'part_tracker',
        });
        await sendPush(car.owner_id, `⚡ ${carName}`, partReminderBody(part.part_name, kmLeft));
      }
    }

    // 2. Document expiry
    const { data: docs } = await supabase.from('documents')
      .select('*').eq('car_id', car.id).not('expiry_date', 'is', null);
    for (const doc of docs ?? []) {
      const daysLeft = Math.ceil((new Date(doc.expiry_date).getTime() - new Date(today).getTime()) / 86400000);
      if (daysLeft > 0 && daysLeft <= 30) {
        const { data: existing } = await supabase.from('reminders').select('id')
          .eq('car_id', car.id).ilike('title', `%${doc.name}%`)
          .eq('is_dismissed', false).maybeSingle();
        if (existing) continue;
        await supabase.from('reminders').insert({
          car_id: car.id,
          title: docReminderTitle(carName),
          description: docReminderBody(doc.name, daysLeft),
          reminder_type: 'date',
          trigger_date: doc.expiry_date,
          source: 'agent',
        });
        await sendPush(car.owner_id, `📄 ${carName}`, docReminderBody(doc.name, daysLeft));
      }
    }

    // 3. Verificación check
    if (car.plates && car.hologram_type) {
      await supabase.functions.invoke('verification-agent', {
        body: { car_id: car.id, plates: car.plates, hologram_type: car.hologram_type, state: 'CDMX' },
      });
    }

    // 4. Update health score
    const score = await computeHealthScore(car.id, car.current_mileage);
    await supabase.from('cars').update({ health_score: score }).eq('id', car.id);
  }

  return new Response(JSON.stringify({ processed: cars.length }), { headers: { 'Content-Type': 'application/json' } });
});
```

- [ ] **Step 3: Build ReminderBanner component**

Create `apps/mobile/components/ReminderBanner.tsx`:
```tsx
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../types';
import { useReminders } from '../hooks/useReminders';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';

const SOURCE_COLOR: Record<string, string> = {
  part_tracker: Colors.warning,
  agent: Colors.primary,
  verification: '#7C3AED',
  manual: Colors.textSecondary,
};

export function ReminderBanner({ reminder }: { reminder: Reminder }) {
  const { dismissReminder } = useReminders([reminder.car_id]);
  const color = SOURCE_COLOR[reminder.source] ?? Colors.textSecondary;

  return (
    <View style={[styles.banner, { borderLeftColor: color }]}>
      <View style={styles.content}>
        <Text style={[Typography.label, { fontWeight: '600' }]}>{reminder.title}</Text>
        {reminder.description && <Text style={Typography.caption}>{reminder.description}</Text>}
      </View>
      <TouchableOpacity onPress={() => dismissReminder(reminder.id)} style={styles.dismiss}>
        <Ionicons name="close" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', backgroundColor: Colors.card, borderLeftWidth: 4, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: 10, paddingLeft: Spacing.sm, elevation: 1 },
  content: { flex: 1, paddingVertical: Spacing.sm },
  dismiss: { padding: Spacing.sm, justifyContent: 'center' },
});
```

- [ ] **Step 4: Deploy and test**
```bash
supabase functions deploy maintenance-agent --no-verify-jwt
supabase functions deploy verification-agent --no-verify-jwt
```
Manually invoke with `{ "scope": "all_users" }`. Verify Approach-framed notifications appear with car name.

- [ ] **Step 5: Commit**
```bash
git add supabase/functions/maintenance-agent/ apps/mobile/
git commit -m "feat(agents): maintenance agent, approach-framed reminders, health score, verification check"
```

---

## Task 8: Verification Agent + SEDEMA Scraper

*(Same logic as v1. Deploy both functions. Key addition: use car's `display_name` in all reminder titles.)*

- [ ] Deploy `verification-agent` and `scrape-verification` from v1 plan — replace any hardcoded "tu auto" with `car.display_name || car.brand` in reminder title generation.
- [ ] Build `apps/mobile/components/VerificationAlert.tsx` from v1 plan.
- [ ] Commit: `feat(agents): verification agent, CDMX schedule, SEDEMA scraper`

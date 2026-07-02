import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireCron, json } from '../_shared/auth.ts';

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

// Mirror of apps/mobile/lib/maintenanceSchedule.ts (source of truth) — keep in sync.
const SERVICE_INTERVALS: Record<string, { km?: number; months?: number; cost: number; label: string }> = {
  oil_change:    { km: 7500,  months: 6,  cost: 700,  label: 'Cambio de aceite' },
  tire_rotation: { km: 10000,             cost: 350,  label: 'Rotación de llantas' },
  air_filter:    { km: 15000,             cost: 350,  label: 'Filtro de aire' },
  alignment:     { km: 20000,             cost: 500,  label: 'Alineación y balanceo' },
  brake_service: { km: 40000,             cost: 1200, label: 'Balatas / frenos' },
  spark_plugs:   { km: 40000,             cost: 900,  label: 'Bujías / afinación' },
  coolant:       { km: 40000, months: 24, cost: 600,  label: 'Anticongelante' },
  battery:       {            months: 36, cost: 2000, label: 'Batería' },
  transmission:  { km: 60000,             cost: 1500, label: 'Aceite de transmisión' },
  inspection:    { km: 10000, months: 6,  cost: 500,  label: 'Revisión general' },
};

interface CarRow {
  id: string;
  owner_id: string;
  current_mileage: number;
}

// Create reminders + push for maintenance that's due or coming soon, from the service log.
async function scheduleReminders(car: CarRow, carName: string) {
  const { data: records } = await supabase
    .from('service_records').select('service_date, mileage_at_service, services').eq('car_id', car.id);
  const today = new Date();

  for (const [type, iv] of Object.entries(SERVICE_INTERVALS)) {
    const recs = (records ?? [])
      .filter((r) => Array.isArray(r.services) && r.services.includes(type))
      .sort((a, b) => b.service_date.localeCompare(a.service_date));
    const last = recs[0];
    if (!last) continue; // never logged → leave it to the in-app "sin registro" view, don't spam push

    let kmLeft: number | null = null;
    let daysLeft: number | null = null;
    if (iv.km != null) kmLeft = (last.mileage_at_service + iv.km) - car.current_mileage;
    if (iv.months != null) {
      const next = new Date(last.service_date + 'T00:00:00');
      next.setMonth(next.getMonth() + iv.months);
      daysLeft = Math.ceil((next.getTime() - today.getTime()) / 86400000);
    }
    const due = (kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft <= 0);
    const soon = (kmLeft != null && kmLeft <= 1500) || (daysLeft != null && daysLeft <= 30);
    if (!due && !soon) continue;

    const { data: existing } = await supabase.from('reminders').select('id')
      .eq('car_id', car.id).eq('source', 'agent').ilike('title', `%${iv.label}%`)
      .eq('is_dismissed', false).maybeSingle();
    if (existing) continue;

    const when = due ? '¡Toca ahora!' : kmLeft != null ? `En ~${Math.max(0, kmLeft).toLocaleString('es-MX')} km` : `En ~${Math.max(0, daysLeft!)} días`;
    await supabase.from('reminders').insert({
      car_id: car.id,
      title: `${iv.label} — tu ${carName}`,
      description: `${when} · costo estimado ~$${iv.cost.toLocaleString('es-MX')} MXN`,
      reminder_type: iv.km != null ? 'mileage' : 'date',
      source: 'agent',
    });
    await sendPush(car.owner_id, `🔧 ${carName}`, `${iv.label}: ${when.toLowerCase()}`);
  }
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
  if (!requireCron(req)) return json({ error: 'forbidden' }, 403);
  const { scope, user_id } = await req.json().catch(() => ({}));
  if (scope !== 'user' && scope !== 'all_users') return json({ error: 'bad_scope' }, 400);
  const today = new Date().toISOString().split('T')[0];

  const query = supabase.from('cars').select('id, owner_id, brand, model, display_name, current_mileage, plates, hologram_type');
  if (scope === 'user' && user_id) query.eq('owner_id', user_id);
  const { data: cars } = await query;
  if (!cars?.length) return new Response('ok', { status: 200 });

  // Refrendo deadline (config-not-constant).
  const { data: cfg } = await supabase.from('app_config').select('value').eq('key', 'refrendo').maybeSingle();
  const refrendoDeadline: string | undefined = cfg?.value?.deadline;
  const refrendoAmount: number | undefined = cfg?.value?.amount_mxn;

  for (const car of cars) {
    const carName = car.display_name || `${car.brand} ${car.model}`;

    // 0. Refrendo (annual plate fee) — remind within 30 days of the deadline.
    if (refrendoDeadline) {
      const dLeft = Math.ceil((new Date(refrendoDeadline).getTime() - new Date(today).getTime()) / 86400000);
      if (dLeft > 0 && dLeft <= 30) {
        const { data: existing } = await supabase.from('reminders').select('id')
          .eq('car_id', car.id).ilike('title', '%Refrendo%').eq('is_dismissed', false).maybeSingle();
        if (!existing) {
          await supabase.from('reminders').insert({
            car_id: car.id,
            title: `Refrendo de tu ${carName}`,
            description: `El refrendo (${refrendoAmount ? `$${refrendoAmount} MXN` : 'placas'}) vence el ${refrendoDeadline}. Pagar a tiempo conserva el subsidio de tenencia.`,
            reminder_type: 'date',
            trigger_date: refrendoDeadline,
            source: 'agent',
          });
          await sendPush(car.owner_id, `🪪 ${carName}`, `Refrendo vence el ${refrendoDeadline}.`);
        }
      }
    }

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

    // 1.5 Maintenance schedule (oil, brakes, etc. from the service log)
    await scheduleReminders(car, carName);

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
        headers: { 'x-cron-secret': Deno.env.get('CRON_SECRET')! },
      });
    }

    // 4. Update health score
    const score = await computeHealthScore(car.id, car.current_mileage);
    await supabase.from('cars').update({ health_score: score }).eq('id', car.id);
  }

  return new Response(JSON.stringify({ processed: cars.length }), { headers: { 'Content-Type': 'application/json' } });
});

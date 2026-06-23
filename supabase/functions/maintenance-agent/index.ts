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

import { service, requireCron, json } from '../_shared/auth.ts';

const supabase = service();

// Hoy No Circula — mirror of apps/mobile/lib/hoyNoCircula.ts (source of truth).
// Cron fires ~05:30 CDMX (11:30 UTC), so the UTC calendar day matches the CDMX day.
const WEEKDAY: Record<number, number[]> = { 1: [5, 6], 2: [7, 8], 3: [3, 4], 4: [1, 2], 5: [9, 0] };

function plateLastDigit(plates?: string): number | null {
  if (!plates) return null;
  const digits = plates.replace(/[^0-9]/g, '');
  return digits ? Number(digits.slice(-1)) : null;
}

function restrictedToday(digit: number, holo: string, electric: boolean, moto: boolean, date: Date, phase: number): boolean {
  const day = date.getDay();
  if (day === 0) return false;
  const h = holo === 'doble_cero' ? '00' : holo;
  const exempt = electric || moto || h === 'exento';

  let restricted = false;
  if (!exempt) {
    if (day >= 1 && day <= 5) {
      if ((h === '1' || h === '2' || h === 'foreign') && WEEKDAY[day].includes(digit)) restricted = true;
    } else if (day === 6) {
      if (h === '2' || h === 'foreign') restricted = true;
      else if (h === '1') {
        const nth = Math.ceil(date.getDate() / 7);
        const rest = digit % 2 === 1 ? [1, 3] : [2, 4];
        if (rest.includes(nth)) restricted = true;
      }
    }
  }
  if (phase >= 1 && !restricted) {
    if (h === '2' || h === 'foreign') restricted = true;
    else if (h === '0' || h === '00') {
      if ((digit % 2 === 0) === (date.getDate() % 2 === 0)) restricted = true;
    }
  }
  return restricted;
}

async function sendPush(userId: string, title: string, body: string) {
  const { data: p } = await supabase.from('profiles').select('push_token').eq('id', userId).single();
  if (!p?.push_token) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: p.push_token, title, body, sound: 'default' }),
  });
}

Deno.serve(async (req) => {
  if (!requireCron(req)) return json({ error: 'forbidden' }, 403);

  const { data: cfg } = await supabase.from('app_config').select('value').eq('key', 'contingencia').maybeSingle();
  const phase = Number(cfg?.value?.phase) || 0;

  const { data: cars } = await supabase
    .from('cars').select('id, owner_id, display_name, plates, hologram_type, is_electric_hybrid, is_moto');

  const today = new Date();
  let pushed = 0;
  for (const car of cars ?? []) {
    const digit = plateLastDigit(car.plates);
    if (digit === null) continue;
    if (restrictedToday(digit, car.hologram_type ?? '0', !!car.is_electric_hybrid, !!car.is_moto, today, phase)) {
      await sendPush(car.owner_id, '🚫 Hoy no circula', `Tu ${car.display_name} descansa hoy. Revisa antes de salir.`);
      pushed++;
    }
  }
  return json({ pushed });
});

import { service, requireCron, json } from '../_shared/auth.ts';
// Mirror of apps/mobile/lib/hoyNoCircula.ts (source of truth); parity asserted
// by scripts/hnc-parity.test.ts.
// Cron fires ~05:30 CDMX (11:30 UTC), so the UTC calendar day matches the CDMX day.
import { plateLastDigit, restrictedToday } from '../_shared/hnc.ts';

const supabase = service();

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

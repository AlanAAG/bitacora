import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireCron, json } from '../_shared/auth.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Holograms exempt from verificación (and electric/hybrid handled by caller).
const EXEMPT = ['00', 'doble_cero', 'exento'];

function getPlateLastDigit(plates: string): string {
  // Mexican plates format: ABC-123 or AB-12-CD — extract last numeric digit
  const digits = plates.replace(/[^0-9]/g, '');
  return digits.slice(-1) || '0';
}

Deno.serve(async (req) => {
  if (!requireCron(req)) return json({ error: 'forbidden' }, 403);
  const { car_id, plates, hologram_type, state = 'CDMX' } = await req.json().catch(() => ({}));
  if (!plates) return json({ error: 'plates required' }, 400);

  if (EXEMPT.includes(hologram_type)) {
    return json({ due_soon: false, exempt: true, message: `Holograma ${hologram_type}: exento de verificación.` });
  }

  const lastDigit = getPlateLastDigit(plates);
  const today = new Date();
  const currentYear = today.getFullYear();

  // The verification MONTH is driven by the plate digit (not the hologram), so match by
  // digit + year across all schedule rows (seeded under hologram '0').
  const { data: schedules } = await supabase
    .from('verification_schedule')
    .select('*')
    .eq('state', state)
    .eq('year', currentYear);

  const matches = (schedules ?? []).filter((s) =>
    s.plate_last_digit.split(',').map((d: string) => d.trim()).includes(lastDigit)
  ).sort((a, b) => a.end_date.localeCompare(b.end_date));
  // Prefer the upcoming/active window (end_date >= today); else the latest past one.
  const todayStr = today.toISOString().split('T')[0];
  const match = matches.find((s) => s.end_date >= todayStr) ?? matches[matches.length - 1];

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
      .eq('is_dismissed', false).maybeSingle();
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

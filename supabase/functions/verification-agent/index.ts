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

  // Find matching schedule entry.
  // plate_last_digit can be '5,6' format — check if lastDigit is in the list.
  const { data: schedules } = await supabase
    .from('verification_schedule')
    .select('*')
    .eq('state', state)
    .eq('hologram', hologram_type || '0')
    .eq('year', currentYear);

  const match = schedules?.find((s) => {
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

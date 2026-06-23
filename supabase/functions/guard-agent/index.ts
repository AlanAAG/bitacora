import Anthropic from 'npm:@anthropic-ai/sdk';
import OpenAI from 'npm:openai';
import { z } from 'npm:zod';
import { service, getUserId, json } from '../_shared/auth.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
const supabase = service();

const Body = z.object({ session_id: z.string().uuid() });

const FLAG_TYPES = ['overcharge', 'unnecessary_service', 'premature_replacement', 'inconsistent_diagnosis'];
const SEVERITIES = ['low', 'medium', 'high'];

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

// ponytail: flat per-severity constants for MVP. Tie to mechanic_quote vs reference_data deltas later.
function estimateSavings(flags: { severity: string }[]): number {
  let total = 0;
  for (const flag of flags) {
    if (flag.severity === 'high') total += 1200;
    else if (flag.severity === 'medium') total += 500;
    else total += 200;
  }
  return total;
}

// Validate + sanitize the model's JSON before it touches the DB (avoids CHECK violations / bad enums).
function sanitize(result: any) {
  const score = Math.max(0, Math.min(100, Number(result?.trust_score) || 0));
  const level = ['green', 'yellow', 'red'].includes(result?.trust_level)
    ? result.trust_level
    : (score >= 75 ? 'green' : score >= 40 ? 'yellow' : 'red');
  const flags = Array.isArray(result?.flags)
    ? result.flags
        .filter((f: any) => FLAG_TYPES.includes(f?.type) && SEVERITIES.includes(f?.severity))
        .map((f: any) => ({
          type: f.type, severity: f.severity,
          description: String(f.description ?? ''),
          mechanic_quote: f.mechanic_quote ? String(f.mechanic_quote) : undefined,
          reference_data: f.reference_data ? String(f.reference_data) : undefined,
        }))
    : [];
  return { trust_score: score, trust_level: level, summary: String(result?.summary ?? ''), flags };
}

Deno.serve(async (req) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: 'invalid_body' }, 400);
  const { session_id } = parsed.data;

  const userId = await getUserId(req);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const { data: session } = await supabase
    .from('guard_sessions')
    .select('*, cars(id, brand, model, year, current_mileage, owner_id)')
    .eq('id', session_id)
    .single();
  if (!session) return json({ error: 'not_found' }, 404);

  const car = session.cars;
  if (car.owner_id !== userId) return json({ error: 'forbidden' }, 403);

  // Enforce quota atomically BEFORE spending on Whisper/Claude.
  const { data: allowed } = await supabase.rpc('consume_guard_credit', { p_user: car.owner_id });
  if (!allowed) return json({ error: 'no_guard_credit' }, 402);

  await supabase.from('guard_sessions').update({ status: 'processing' }).eq('id', session_id);

  // The recorded file may be .m4a/.aac/.mp4 depending on platform; find whatever was uploaded.
  const { data: listed } = await supabase.storage.from('guard-audio').list('', { search: session_id });
  const audioName = listed?.find((o) => o.name.startsWith(session_id))?.name;

  try {
    let transcript = '';
    if (audioName) {
      const { data: signed } = await supabase.storage.from('guard-audio').createSignedUrl(audioName, 300);
      if (signed?.signedUrl) {
        const audioBlob = await (await fetch(signed.signedUrl)).blob();
        const whisper = await openai.audio.transcriptions.create({
          file: new File([audioBlob], audioName, { type: 'audio/m4a' }),
          model: 'whisper-1',
          language: 'es',
        });
        transcript = whisper.text;
      }
    }

    const cleanup = async () => { if (audioName) await supabase.storage.from('guard-audio').remove([audioName]).catch(() => {}); };

    if (!transcript || transcript.trim().length < 20) {
      await supabase.from('guard_sessions').update({
        status: 'failed',
        error_message: 'No se pudo transcribir el audio. Asegúrate de grabar con el teléfono cerca.',
      }).eq('id', session_id);
      await cleanup();
      return json({ error: 'transcription_failed' }, 400);
    }

    const { data: history } = await supabase
      .from('service_records').select('*').eq('car_id', car.id)
      .order('service_date', { ascending: false }).limit(8);
    const { data: parts } = await supabase.from('parts').select('*').eq('car_id', car.id);

    const analysis = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: `Eres un mecánico experto con 20 años de experiencia en México y un asesor de protección al consumidor.
Ayudas a dueños de autos a verificar que los mecánicos sean honestos.
Conoces los precios de mercado para servicios automotrices en México (CDMX, 2026).
REGLA CRÍTICA: Solo marca como RED (grave) cuando estás MUY seguro de que hay un problema real.
Para casos dudosos, usa YELLOW. Es preferible un falso negativo que un falso positivo.
Un mecánico honesto no merece ser acusado injustamente.
Responde SIEMPRE en español y SOLO con el JSON solicitado, sin texto adicional.`,
      messages: [{
        role: 'user',
        content: `Analiza la siguiente conversación con un mecánico. Verifica si los servicios recomendados, los precios cobrados y el diagnóstico son razonables.

AUTO DEL CLIENTE:
- ${car.brand} ${car.model} ${car.year}
- Kilometraje actual: ${car.current_mileage?.toLocaleString('es-MX') ?? 'N/A'} km

HISTORIAL DE SERVICIOS RECIENTES:
${history?.map((r) => `- ${r.service_date}: ${r.services?.join(', ')} @ ${r.mileage_at_service?.toLocaleString('es-MX')} km${r.total_cost_mxn ? ` — $${r.total_cost_mxn} MXN` : ''}`).join('\n') || 'Sin historial disponible'}

REFACCIONES INSTALADAS RECIENTEMENTE:
${parts?.map((p) => `- ${p.part_name}: instalada a ${p.installed_mileage?.toLocaleString('es-MX')} km${p.expected_lifetime_km ? `, duración esperada: ${p.expected_lifetime_km?.toLocaleString('es-MX')} km` : ''}`).join('\n') || 'Sin refacciones registradas'}

PRECIOS DE REFERENCIA EN CDMX (2026):
${MX_PRICE_BENCHMARKS}

TRANSCRIPCIÓN DE LA CONVERSACIÓN:
"${transcript}"

Responde con este JSON exacto:
{
  "trust_score": 85,
  "trust_level": "green",
  "summary": "Resumen en 2 oraciones. Empieza con el veredicto general.",
  "flags": [
    { "type": "overcharge", "severity": "high", "description": "...", "mechanic_quote": "...", "reference_data": "..." }
  ]
}
Tipos de flag: overcharge, unnecessary_service, premature_replacement, inconsistent_diagnosis
Severidad: low, medium, high. trust_score 0-100. trust_level green(>=75)/yellow(40-74)/red(<40).
Si no hay problemas, devuelve flags: []`,
      }],
    });

    const textBlock = analysis.content.find((b) => b.type === 'text');
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in analysis response');
    const result = sanitize(JSON.parse(jsonMatch[0]));

    const estimatedSavings = result.flags.length > 0 ? estimateSavings(result.flags) : 0;

    // Privacy: delete audio (only the transcript persists).
    await cleanup();

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

    return json({ ...result, estimated_savings_mxn: estimatedSavings });
  } catch (err) {
    if (audioName) await supabase.storage.from('guard-audio').remove([audioName]).catch(() => {});
    await supabase.from('guard_sessions').update({
      status: 'failed',
      error_message: (err as Error).message,
    }).eq('id', session_id);
    return json({ error: (err as Error).message }, 500);
  }
});

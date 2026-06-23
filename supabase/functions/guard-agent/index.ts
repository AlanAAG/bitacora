import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import OpenAI from 'npm:openai';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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

// Estimate savings based on flags found
// ponytail: flat per-severity constants for MVP. Tie to mechanic_quote vs reference_data deltas later.
function estimateSavings(flags: any[]): number {
  let total = 0;
  for (const flag of flags) {
    if (flag.severity === 'high') total += 1200;
    else if (flag.severity === 'medium') total += 500;
    else total += 200;
  }
  return total;
}

Deno.serve(async (req) => {
  const { session_id } = await req.json();

  const { data: session } = await supabase
    .from('guard_sessions')
    .select('*, cars(id, brand, model, year, current_mileage, owner_id)')
    .eq('id', session_id)
    .single();
  if (!session) return new Response('Not found', { status: 404 });

  await supabase.from('guard_sessions').update({ status: 'processing' }).eq('id', session_id);

  const car = session.cars;

  try {
    // 1. Get signed URL for audio
    const { data: signed } = await supabase.storage
      .from('guard-audio')
      .createSignedUrl(`${session_id}.m4a`, 300);

    // 2. Transcribe via Whisper
    let transcript = '';
    if (signed?.signedUrl) {
      const audioRes = await fetch(signed.signedUrl);
      const audioBlob = await audioRes.blob();
      const whisper = await openai.audio.transcriptions.create({
        file: new File([audioBlob], 'audio.m4a', { type: 'audio/m4a' }),
        model: 'whisper-1',
        language: 'es',
      });
      transcript = whisper.text;
    }

    if (!transcript || transcript.trim().length < 20) {
      await supabase.from('guard_sessions').update({
        status: 'failed',
        error_message: 'No se pudo transcribir el audio. Asegúrate de grabar con el teléfono cerca.',
      }).eq('id', session_id);
      await supabase.storage.from('guard-audio').remove([`${session_id}.m4a`]);
      return new Response(JSON.stringify({ error: 'transcription_failed' }), { status: 400 });
    }

    // 3. Fetch car service context
    const { data: history } = await supabase
      .from('service_records').select('*').eq('car_id', car.id)
      .order('service_date', { ascending: false }).limit(8);

    const { data: parts } = await supabase
      .from('parts').select('*').eq('car_id', car.id);

    // 4. Analyze with Claude
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
  "summary": "Resumen en 2 oraciones de lo que encontraste. Empieza con el veredicto general.",
  "flags": [
    {
      "type": "overcharge",
      "severity": "high",
      "description": "Descripción clara del problema en español.",
      "mechanic_quote": "texto exacto que dijo el mecánico sobre este punto",
      "reference_data": "el dato o precio de referencia que usaste para comparar"
    }
  ]
}

Tipos de flag: overcharge, unnecessary_service, premature_replacement, inconsistent_diagnosis
Niveles de severidad: low, medium, high
trust_score: 0-100 (100 = completamente honesto, 0 = múltiples señales graves)
trust_level: "green" (score >= 75), "yellow" (40-74), "red" (< 40)
Si no hay problemas, devuelve flags: []`,
      }],
    });

    const textBlock = analysis.content.find((b) => b.type === 'text');
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in analysis response');
    const result = JSON.parse(jsonMatch[0]);

    // 5. Estimate savings
    const estimatedSavings = result.flags.length > 0 ? estimateSavings(result.flags) : 0;

    // 6. Decrement free sessions if applicable
    const { data: profile } = await supabase.from('profiles')
      .select('free_guard_sessions_remaining').eq('id', car.owner_id).single();
    const { data: sub } = await supabase.from('subscriptions')
      .select('plan').eq('user_id', car.owner_id).maybeSingle();
    const isPaidGuard = sub?.plan === 'pro_guard';
    if (!isPaidGuard && profile && profile.free_guard_sessions_remaining > 0) {
      await supabase.from('profiles')
        .update({ free_guard_sessions_remaining: profile.free_guard_sessions_remaining - 1 })
        .eq('id', car.owner_id);
    }

    // 7. Delete audio (privacy — only transcript persists)
    await supabase.storage.from('guard-audio').remove([`${session_id}.m4a`]);

    // 8. Save final result
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

    return new Response(JSON.stringify({ ...result, estimated_savings_mxn: estimatedSavings }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Always delete audio on failure too
    await supabase.storage.from('guard-audio').remove([`${session_id}.m4a`]).catch(() => {});
    await supabase.from('guard_sessions').update({
      status: 'failed',
      error_message: (err as Error).message,
    }).eq('id', session_id);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});

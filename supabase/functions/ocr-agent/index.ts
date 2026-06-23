import Anthropic from 'npm:@anthropic-ai/sdk';
import { z } from 'npm:zod';
import { service, getUserId, json } from '../_shared/auth.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = service();

const Body = z.object({ job_id: z.string().uuid() });

Deno.serve(async (req) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: 'invalid_body' }, 400);
  const { job_id } = parsed.data;

  const userId = await getUserId(req);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  // Load job + owning car; verify ownership before doing any (paid) work.
  const { data: job } = await supabase
    .from('ocr_jobs').select('*, cars(owner_id)').eq('id', job_id).single();
  if (!job) return json({ error: 'not_found' }, 404);
  if (job.cars?.owner_id !== userId) return json({ error: 'forbidden' }, 403);

  await supabase.from('ocr_jobs').update({ status: 'processing' }).eq('id', job_id);

  const { data: signed } = await supabase.storage
    .from('ocr-photos').createSignedUrl(job.image_url.replace('ocr-photos/', ''), 300);
  if (!signed?.signedUrl) {
    await supabase.from('ocr_jobs').update({ status: 'failed', error_message: 'No se pudo leer la imagen.' }).eq('id', job_id);
    return json({ error: 'signed_url_failed' }, 500);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: signed.signedUrl } },
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

Return ONLY JSON, no prose: { "records": [...], "confidence": 0.0-1.0, "warnings": ["..."] }
If the image is not a car logbook, return { "records": [], "confidence": 0, "warnings": ["Image does not appear to be a car logbook"] }`,
          },
        ],
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('Unexpected response type');
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const extracted = JSON.parse(jsonMatch[0]);

    await supabase.from('ocr_jobs').update({
      status: 'complete',
      extracted_data: extracted,
      completed_at: new Date().toISOString(),
    }).eq('id', job_id);

    return json({ success: true, data: extracted });
  } catch (err) {
    await supabase.from('ocr_jobs').update({
      status: 'failed',
      error_message: (err as Error).message,
    }).eq('id', job_id);
    return json({ error: (err as Error).message }, 500);
  }
});

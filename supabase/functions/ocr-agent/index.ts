import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const { job_id } = await req.json();

  // Mark job as processing
  await supabase.from('ocr_jobs').update({ status: 'processing' }).eq('id', job_id);

  const { data: job } = await supabase.from('ocr_jobs').select('*').eq('id', job_id).single();
  if (!job) return new Response('Job not found', { status: 404 });

  // Get signed URL for the image
  const { data: signed } = await supabase.storage
    .from('ocr-photos').createSignedUrl(job.image_url.replace('ocr-photos/', ''), 300);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: signed!.signedUrl },
          },
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

    // Find the text block (robust against any leading non-text block).
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

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    await supabase.from('ocr_jobs').update({
      status: 'failed',
      error_message: (err as Error).message,
    }).eq('id', job_id);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});

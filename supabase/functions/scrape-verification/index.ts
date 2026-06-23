import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SEDEMA_URL = 'https://www.sedema.cdmx.gob.mx/programas/programa/verificacion-vehicular';

Deno.serve(async (_req) => {
  try {
    // Fetch SEDEMA page
    const res = await fetch(SEDEMA_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bitacora/1.0)' },
    });
    const html = await res.text();

    // Use Claude to extract the current year's schedule from raw HTML
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Extract the vehicle verification (verificación vehicular) calendar for CDMX from this HTML.
Return ONLY a JSON array, no prose:
[{
  "state": "CDMX",
  "plate_last_digit": "5,6",
  "hologram": "0",
  "semester": 1,
  "year": 2026,
  "start_date": "2026-01-02",
  "end_date": "2026-02-28",
  "notes": "optional context"
}]

HTML (truncated to first 50KB):
${html.slice(0, 50000)}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No schedule found in page');

    const schedules = JSON.parse(jsonMatch[0]);

    // Upsert schedule entries
    for (const entry of schedules) {
      await supabase.from('verification_schedule').upsert(entry, {
        onConflict: 'state,plate_last_digit,hologram,semester,year',
      });
    }

    return new Response(JSON.stringify({ updated: schedules.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // ponytail: fall back gracefully — the table already has seeded 2026 data
    console.error('Scrape failed, using seeded data:', (err as Error).message);
    return new Response(JSON.stringify({ updated: 0, fallback: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

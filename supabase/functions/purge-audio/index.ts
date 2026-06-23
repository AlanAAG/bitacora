import { service, requireCron, json } from '../_shared/auth.ts';

const supabase = service();

// Privacy: guard audio must not persist. Delete any guard-audio object older than ~15 min
// (covers orphans from app crashes between upload and a successful guard-agent run).
Deno.serve(async (req) => {
  if (!requireCron(req)) return json({ error: 'forbidden' }, 403);

  const { data: objs } = await supabase.storage.from('guard-audio').list('', { limit: 1000 });
  const cutoff = Date.now() - 15 * 60 * 1000;
  const stale = (objs ?? [])
    .filter((o) => o.created_at && new Date(o.created_at).getTime() < cutoff)
    .map((o) => o.name);

  if (stale.length) await supabase.storage.from('guard-audio').remove(stale);
  return json({ purged: stale.length });
});

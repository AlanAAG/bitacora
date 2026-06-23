import { service, getUserId, json } from '../_shared/auth.ts';

const supabase = service();

// Server-granted 7-day Pro+Guardia trial. Replaces the client-side upsert (which let
// any user self-grant pro_guard). One trial per user; no payment yet.
Deno.serve(async (req) => {
  const userId = await getUserId(req);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const { data: existing } = await supabase
    .from('subscriptions').select('id, plan, valid_until').eq('user_id', userId).maybeSingle();
  if (existing) return json({ error: 'already_subscribed', plan: existing.plan }, 409);

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);
  const validUntil = trialEnd.toISOString().split('T')[0];

  const { error } = await supabase.from('subscriptions')
    .insert({ user_id: userId, plan: 'pro_guard', valid_until: validUntil });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, plan: 'pro_guard', valid_until: validUntil });
});

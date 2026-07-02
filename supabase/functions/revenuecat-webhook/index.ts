import { service, json } from '../_shared/auth.ts';

const supabase = service();

// RevenueCat → subscriptions sync. Deploy with --no-verify-jwt; gated instead by the
// Authorization header value configured in the RevenueCat dashboard webhook settings.
// app_user_id is the Supabase user id (set by identifyPurchases in the app).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ error: 'forbidden' }, 403);
  }

  const body = await req.json().catch(() => null);
  const event = body?.event;
  if (!event?.type) return json({ error: 'invalid_body' }, 400);
  if (event.type === 'TEST') return json({ ok: true, skipped: 'test_event' });

  const userId: string = event.app_user_id ?? '';
  if (!UUID_RE.test(userId)) return json({ ok: true, skipped: 'anonymous_user' });

  // Single plan for now: entitlement active ⇔ pro_guard. Every event type carries
  // expiration_at_ms (renewals extend it; cancellations let it lapse), so deriving
  // status from the date handles all of them uniformly. consume_guard_credit and the
  // client both re-check valid_until against today, so a missed EXPIRATION event
  // degrades gracefully.
  const expiresMs = Number(event.expiration_at_ms) || 0;
  const active = expiresMs > Date.now();
  const validUntil = expiresMs ? new Date(expiresMs).toISOString().split('T')[0] : null;

  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    plan: active ? 'pro_guard' : 'free',
    valid_until: validUntil,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, plan: active ? 'pro_guard' : 'free' });
});

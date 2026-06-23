import { service, getUserId, json } from '../_shared/auth.ts';

const supabase = service();

// ARCO (Cancelación): delete the caller's auth user. The auth.users delete cascades to
// profiles → cars → service_records/parts/documents/reminders/guard_sessions.
Deno.serve(async (req) => {
  const userId = await getUserId(req);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});

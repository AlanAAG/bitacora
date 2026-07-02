import { createClient } from 'npm:@supabase/supabase-js@2';

// Service-role client (bypasses RLS) — only used after auth/ownership is verified.
export const service = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Resolve the caller's user id from their JWT, or null if unauthenticated.
export async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth) return null;
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: { user } } = await client.auth.getUser();
  return user?.id ?? null;
}

// Cron/internal functions are gated by a shared secret, not by JWT.
export function requireCron(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET');
  return !!expected && req.headers.get('x-cron-secret') === expected;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

-- 004_pg_cron_jobs.sql
-- Requires pg_cron + pg_net (enabled in 001) and two Vault secrets (see SETUP.md):
--   vault secret 'project_url'  = https://YOUR_PROJECT.supabase.co
--   vault secret 'cron_secret'  = a long random string (also set as the CRON_SECRET function secret)
-- The cron functions are gated by the x-cron-secret header (NOT by JWT) so they are not
-- publicly invocable. The service-role key is never stored in a readable GUC.

-- Daily 09:00 UTC (~03:00 CDMX): maintenance agent (part wear, doc expiry, refrendo, health, verificación)
SELECT cron.schedule(
  'daily-maintenance-agent',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/maintenance-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{"trigger":"cron","scope":"all_users"}'::jsonb
  );
  $$
);

-- Daily 11:30 UTC (~05:30 CDMX): Hoy No Circula push — tell users whose car cannot circulate today
SELECT cron.schedule(
  'daily-circulation',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/daily-circulation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Every 15 min: purge orphaned guard-audio (privacy — audio must not persist)
SELECT cron.schedule(
  'purge-guard-audio',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/purge-audio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Weekly Monday 06:00 UTC: scrape SEDEMA verification schedule
SELECT cron.schedule(
  'weekly-verification-scrape',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/scrape-verification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

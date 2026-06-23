-- 004_pg_cron_jobs.sql
-- Requires pg_cron extension (enabled in Supabase dashboard: Database → Extensions → pg_cron)
-- Requires app.supabase_url and app.service_key (set in migration 006 / dashboard, see README).

-- Daily: run maintenance agent for all users (check mileage-based reminders)
SELECT cron.schedule(
  'daily-maintenance-agent',
  '0 9 * * *',  -- 9am UTC daily (3am CDMX)
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/maintenance-agent',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"trigger":"cron","scope":"all_users"}'::jsonb
  );
  $$
);

-- Weekly Monday: scrape SEDEMA verification schedule
SELECT cron.schedule(
  'weekly-verification-scrape',
  '0 6 * * 1',  -- 6am UTC every Monday
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/scrape-verification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

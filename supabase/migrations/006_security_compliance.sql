-- 006_security_compliance.sql
-- Hardening pass: privilege fixes, atomic guard quota, storage RLS, definer search_path,
-- granular consent, real hologram model, and app_config.
-- NOTE: if your migration runner rejects the ALTER TYPE ADD VALUE lines inside a
-- transaction block, run those three lines on their own first, then the rest.

-- ===== Hologram model (real CDMX values) =====
ALTER TYPE hologram_type ADD VALUE IF NOT EXISTS '1';
ALTER TYPE hologram_type ADD VALUE IF NOT EXISTS '2';
ALTER TYPE hologram_type ADD VALUE IF NOT EXISTS 'foreign';

ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_electric_hybrid BOOLEAN DEFAULT false;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_moto BOOLEAN DEFAULT false;

-- ===== Granular consent (LFPDPPP) =====
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_location    BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_audio       BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_transcripts BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

-- ===== Privilege hardening =====

-- subscriptions: clients read-only; only service role writes (trial fn / billing webhook)
DROP POLICY IF EXISTS "subscriptions_own" ON subscriptions;
CREATE POLICY "subscriptions_read_own" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- referral_events: clients read-only; writes only via the definer trigger / service role
DROP POLICY IF EXISTS "referrals_own" ON referral_events;
CREATE POLICY "referrals_read_own" ON referral_events FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- profiles: clients may only UPDATE non-privileged columns.
-- (free_guard_sessions_remaining / referred_by / referral_code stay service-role-only.)
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, push_token, location_state, guard_consent_given,
  consent_location, consent_audio, consent_transcripts, privacy_accepted_at)
  ON profiles TO authenticated;

-- ===== Atomic guard-credit consumption (server-enforced quota) =====
CREATE OR REPLACE FUNCTION consume_guard_credit(p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ok boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions
             WHERE user_id = p_user AND plan = 'pro_guard'
               AND (valid_until IS NULL OR valid_until >= current_date)) THEN
    RETURN true;
  END IF;
  UPDATE public.profiles
     SET free_guard_sessions_remaining = free_guard_sessions_remaining - 1
   WHERE id = p_user AND free_guard_sessions_remaining > 0
   RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END $$;
REVOKE EXECUTE ON FUNCTION consume_guard_credit(uuid) FROM authenticated, anon;

-- ===== Harden existing SECURITY DEFINER functions (search_path) =====

-- Create the profile on signup AND link the referral atomically (works even with
-- email confirmation, since this runs as the auth trigger regardless of session).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ref_code text; ref_id uuid;
BEGIN
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL THEN
    SELECT id INTO ref_id FROM public.profiles WHERE referral_code = ref_code;
  END IF;
  INSERT INTO public.profiles (id, full_name, referred_by)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name',
            CASE WHEN ref_id IS DISTINCT FROM NEW.id THEN ref_id ELSE NULL END);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION handle_referral_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL
     AND NEW.referred_by <> NEW.id
     AND NOT EXISTS (SELECT 1 FROM public.referral_events WHERE referred_id = NEW.id) THEN
    UPDATE public.profiles SET free_guard_sessions_remaining = free_guard_sessions_remaining + 5
      WHERE id = NEW.referred_by;
    UPDATE public.profiles SET free_guard_sessions_remaining = free_guard_sessions_remaining + 5
      WHERE id = NEW.id;
    INSERT INTO public.referral_events (referrer_id, referred_id, sessions_awarded)
      VALUES (NEW.referred_by, NEW.id, true);
  END IF;
  RETURN NEW;
END $$;

-- ===== ARCO: export the caller's own data =====
CREATE OR REPLACE FUNCTION export_my_data() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE AS $$
  SELECT jsonb_build_object(
    'profile',         (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = auth.uid()),
    'subscriptions',   (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]') FROM public.subscriptions s WHERE s.user_id = auth.uid()),
    'cars',            (SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]') FROM public.cars c WHERE c.owner_id = auth.uid()),
    'service_records', (SELECT coalesce(jsonb_agg(to_jsonb(sr)), '[]') FROM public.service_records sr JOIN public.cars c ON c.id = sr.car_id WHERE c.owner_id = auth.uid()),
    'parts',           (SELECT coalesce(jsonb_agg(to_jsonb(pt)), '[]') FROM public.parts pt JOIN public.cars c ON c.id = pt.car_id WHERE c.owner_id = auth.uid()),
    'documents',       (SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]') FROM public.documents d JOIN public.cars c ON c.id = d.car_id WHERE c.owner_id = auth.uid()),
    'reminders',       (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]') FROM public.reminders r JOIN public.cars c ON c.id = r.car_id WHERE c.owner_id = auth.uid()),
    'guard_sessions',  (SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]') FROM public.guard_sessions g JOIN public.cars c ON c.id = g.car_id WHERE c.owner_id = auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION export_my_data() TO authenticated;

-- ===== Storage RLS (private buckets — ownership-scoped by object path) =====
-- ocr-photos: '<carId>/<ts>.jpg'
CREATE POLICY "ocr_photos_own" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'ocr-photos' AND EXISTS (
  SELECT 1 FROM public.cars WHERE cars.id::text = split_part(name, '/', 1) AND cars.owner_id = auth.uid()))
WITH CHECK (bucket_id = 'ocr-photos' AND EXISTS (
  SELECT 1 FROM public.cars WHERE cars.id::text = split_part(name, '/', 1) AND cars.owner_id = auth.uid()));

-- car-documents: '<carId>/<ts>-<name>'
CREATE POLICY "car_documents_own" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'car-documents' AND EXISTS (
  SELECT 1 FROM public.cars WHERE cars.id::text = split_part(name, '/', 1) AND cars.owner_id = auth.uid()))
WITH CHECK (bucket_id = 'car-documents' AND EXISTS (
  SELECT 1 FROM public.cars WHERE cars.id::text = split_part(name, '/', 1) AND cars.owner_id = auth.uid()));

-- guard-audio: '<sessionId>.<ext>'
CREATE POLICY "guard_audio_own" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'guard-audio' AND EXISTS (
  SELECT 1 FROM public.guard_sessions s JOIN public.cars c ON c.id = s.car_id
  WHERE s.id::text = split_part(name, '.', 1) AND c.owner_id = auth.uid()))
WITH CHECK (bucket_id = 'guard-audio' AND EXISTS (
  SELECT 1 FROM public.guard_sessions s JOIN public.cars c ON c.id = s.car_id
  WHERE s.id::text = split_part(name, '.', 1) AND c.owner_id = auth.uid()));

-- guard-cards: public bucket (read open via public URL). Writes scoped to owner; key '<sessionId>/<rand>.png'
CREATE POLICY "guard_cards_write_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'guard-cards' AND EXISTS (
  SELECT 1 FROM public.guard_sessions s JOIN public.cars c ON c.id = s.car_id
  WHERE s.id::text = split_part(name, '/', 1) AND c.owner_id = auth.uid()));
CREATE POLICY "guard_cards_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'guard-cards' AND EXISTS (
  SELECT 1 FROM public.guard_sessions s JOIN public.cars c ON c.id = s.car_id
  WHERE s.id::text = split_part(name, '/', 1) AND c.owner_id = auth.uid()));

-- ===== app_config (config-not-constant; public read) =====
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_config_read" ON app_config FOR SELECT USING (true);

INSERT INTO app_config (key, value) VALUES
  ('verificacion', '{"note":"UMA-pegged; confirm against SEDEMA each January","cost_mxn":null,"late_fine_mxn":null}'),
  ('hoy_no_circula', '{"fine_min_mxn":2346,"fine_max_mxn":3519}'),
  ('refrendo', '{"amount_mxn":760,"deadline":"2026-03-31","subsidy_value_max_mxn":638000}'),
  ('contingencia', '{"phase":"none"}');

-- 005_referrals_subscriptions.sql
-- v2 additions: referrals, subscriptions, guard savings/share card, cars.display_name.

-- Add to profiles
ALTER TABLE profiles ADD COLUMN guard_consent_given BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8);
ALTER TABLE profiles ADD COLUMN referred_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN free_guard_sessions_remaining INTEGER DEFAULT 3;

-- Add to guard_sessions
ALTER TABLE guard_sessions ADD COLUMN estimated_savings_mxn NUMERIC(10,2);
ALTER TABLE guard_sessions ADD COLUMN share_card_url TEXT;

-- Add to cars
ALTER TABLE cars ADD COLUMN display_name TEXT GENERATED ALWAYS AS (
  COALESCE(nickname, brand || ' ' || model)
) STORED;

-- Referrals table
CREATE TABLE referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id),
  referred_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,  -- one referral per referred user
  created_at TIMESTAMPTZ DEFAULT now(),
  sessions_awarded BOOLEAN DEFAULT false
);

-- Subscriptions table (simple — no Stripe in MVP, just manual flag)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id),
  plan TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'pro_guard'
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for new tables
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own" ON referral_events FOR ALL
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "subscriptions_own" ON subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Function: award guard sessions on referral.
-- ponytail: fires on the UPDATE that sets referred_by (signup.tsx sets it after the
-- auth trigger already created the profile row) AND on direct INSERT-with-referred_by.
-- Idempotent via referral_events.referred_id UNIQUE — awards at most once per referred user.
-- Reward is symmetric (+5/+5) to match the in-app copy ("ambos reciben 5 sesiones").
CREATE OR REPLACE FUNCTION handle_referral_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL
     AND NEW.referred_by <> NEW.id
     AND NOT EXISTS (SELECT 1 FROM referral_events WHERE referred_id = NEW.id) THEN
    UPDATE profiles SET free_guard_sessions_remaining = free_guard_sessions_remaining + 5
      WHERE id = NEW.referred_by;
    UPDATE profiles SET free_guard_sessions_remaining = free_guard_sessions_remaining + 5
      WHERE id = NEW.id;
    INSERT INTO referral_events (referrer_id, referred_id, sessions_awarded)
      VALUES (NEW.referred_by, NEW.id, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_referral_insert
  AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION handle_referral_signup();

CREATE TRIGGER on_profile_referral_update
  AFTER UPDATE OF referred_by ON profiles FOR EACH ROW
  WHEN (OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL)
  EXECUTE FUNCTION handle_referral_signup();

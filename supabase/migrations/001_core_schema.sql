-- 001_core_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enums
CREATE TYPE fuel_type AS ENUM ('gasoline', 'diesel', 'hybrid', 'electric', 'gas');
CREATE TYPE service_type AS ENUM ('oil_change', 'tire_rotation', 'brake_service', 'transmission', 'air_filter', 'spark_plugs', 'coolant', 'battery', 'alignment', 'inspection', 'other');
CREATE TYPE reminder_type AS ENUM ('mileage', 'date', 'both');
CREATE TYPE guard_status AS ENUM ('recording', 'processing', 'complete', 'failed');
CREATE TYPE doc_type AS ENUM ('insurance', 'verification', 'plates', 'repuve', 'other');
CREATE TYPE hologram_type AS ENUM ('0', '00', 'doble_cero', 'exento');

-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  push_token TEXT,
  location_state TEXT DEFAULT 'CDMX',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cars
CREATE TABLE cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1980 AND year <= 2030),
  color TEXT,
  plates TEXT,
  vin TEXT,
  fuel_type fuel_type DEFAULT 'gasoline',
  current_mileage INTEGER DEFAULT 0,
  hologram_type hologram_type,
  is_primary BOOLEAN DEFAULT false,
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Service log
CREATE TABLE service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  mileage_at_service INTEGER NOT NULL,
  shop_name TEXT,
  shop_address TEXT,
  services service_type[] NOT NULL,
  description TEXT,
  total_cost_mxn NUMERIC(10,2),
  parts_replaced JSONB DEFAULT '[]',
  notes TEXT,
  receipt_url TEXT,
  imported_via_ocr BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Parts tracker
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  service_record_id UUID REFERENCES service_records(id),
  part_name TEXT NOT NULL,
  installed_mileage INTEGER NOT NULL,
  installed_date DATE NOT NULL,
  expected_lifetime_km INTEGER,
  expected_lifetime_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type reminder_type NOT NULL,
  trigger_mileage INTEGER,
  trigger_date DATE,
  is_dismissed BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual',  -- 'manual' | 'part_tracker' | 'agent' | 'verification'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document vault
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  doc_type doc_type NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guard sessions
CREATE TABLE guard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  shop_name TEXT,
  status guard_status DEFAULT 'recording',
  transcript TEXT,
  trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
  trust_level TEXT,  -- 'green' | 'yellow' | 'red'
  flags JSONB DEFAULT '[]',
  summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Verification schedule (populated by scraper agent)
CREATE TABLE verification_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL DEFAULT 'CDMX',
  plate_last_digit TEXT NOT NULL,  -- '0'-'9' or ranges like '0,1'
  hologram TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester IN (1,2)),
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  UNIQUE(state, plate_last_digit, hologram, semester, year)
);

-- OCR import queue (for async processing)
CREATE TABLE ocr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'processing' | 'complete' | 'failed'
  extracted_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Triggers: updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cars_updated_at BEFORE UPDATE ON cars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

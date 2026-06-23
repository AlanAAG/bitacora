-- 002_rls_policies.sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE guard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_schedule ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- cars: own cars only
CREATE POLICY "cars_own" ON cars FOR ALL USING (auth.uid() = owner_id);

-- service_records: via car ownership
CREATE POLICY "service_records_own" ON service_records FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = service_records.car_id AND cars.owner_id = auth.uid()));

-- parts: via car ownership
CREATE POLICY "parts_own" ON parts FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = parts.car_id AND cars.owner_id = auth.uid()));

-- reminders: via car ownership
CREATE POLICY "reminders_own" ON reminders FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = reminders.car_id AND cars.owner_id = auth.uid()));

-- documents: via car ownership
CREATE POLICY "documents_own" ON documents FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = documents.car_id AND cars.owner_id = auth.uid()));

-- guard_sessions: via car ownership
CREATE POLICY "guard_sessions_own" ON guard_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = guard_sessions.car_id AND cars.owner_id = auth.uid()));

-- ocr_jobs: via car ownership
CREATE POLICY "ocr_jobs_own" ON ocr_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = ocr_jobs.car_id AND cars.owner_id = auth.uid()));

-- verification_schedule: public read
CREATE POLICY "verification_schedule_read" ON verification_schedule FOR SELECT USING (true);

-- profiles: auto-create on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

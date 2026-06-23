export type FuelType = 'gasoline' | 'diesel' | 'hybrid' | 'electric' | 'gas';
export type ServiceType = 'oil_change' | 'tire_rotation' | 'brake_service' | 'transmission' | 'air_filter' | 'spark_plugs' | 'coolant' | 'battery' | 'alignment' | 'inspection' | 'other';
export type GuardStatus = 'recording' | 'processing' | 'complete' | 'failed';
export type DocType = 'insurance' | 'verification' | 'plates' | 'repuve' | 'other';

export interface Car {
  id: string;
  owner_id: string;
  nickname?: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  plates?: string;
  vin?: string;
  fuel_type: FuelType;
  current_mileage: number;
  hologram_type?: '0' | '00' | 'doble_cero' | 'exento';
  is_primary: boolean;
  health_score: number;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceRecord {
  id: string;
  car_id: string;
  service_date: string;
  mileage_at_service: number;
  shop_name?: string;
  shop_address?: string;
  services: ServiceType[];
  description?: string;
  total_cost_mxn?: number;
  parts_replaced: PartReplaced[];
  notes?: string;
  receipt_url?: string;
  imported_via_ocr: boolean;
  created_at: string;
}

export interface PartReplaced {
  name: string;
  brand?: string;
  cost_mxn?: number;
}

export interface Part {
  id: string;
  car_id: string;
  service_record_id?: string;
  part_name: string;
  installed_mileage: number;
  installed_date: string;
  expected_lifetime_km?: number;
  expected_lifetime_days?: number;
  notes?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  car_id: string;
  title: string;
  description?: string;
  reminder_type: 'mileage' | 'date' | 'both';
  trigger_mileage?: number;
  trigger_date?: string;
  is_dismissed: boolean;
  is_sent: boolean;
  source: 'manual' | 'part_tracker' | 'agent' | 'verification';
  created_at: string;
}

export interface GuardSession {
  id: string;
  car_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  shop_name?: string;
  status: GuardStatus;
  transcript?: string;
  trust_score?: number;
  trust_level?: 'green' | 'yellow' | 'red';
  flags: GuardFlag[];
  summary?: string;
  estimated_savings_mxn?: number;
  share_card_url?: string;
  error_message?: string;
}

export interface GuardFlag {
  type: 'overcharge' | 'unnecessary_service' | 'premature_replacement' | 'inconsistent_diagnosis';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mechanic_quote?: string;
  reference_data?: string;
}

export interface VerificationSchedule {
  id: string;
  state: string;
  plate_last_digit: string;
  hologram: string;
  semester: number;
  year: number;
  start_date: string;
  end_date: string;
  notes?: string;
}

export interface Document {
  id: string;
  car_id: string;
  doc_type: DocType;
  name: string;
  file_url: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'pro_guard';
  valid_until?: string;
}

export interface ReferralEvent {
  id: string;
  referrer_id: string;
  referred_id: string;
  sessions_awarded: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name?: string;
  push_token?: string;
  location_state: string;
  guard_consent_given: boolean;
  referral_code: string;
  referred_by?: string;
  free_guard_sessions_remaining: number;
}

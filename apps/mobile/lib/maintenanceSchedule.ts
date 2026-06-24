// Maintenance-advisor engine: car + mileage + past services -> "what's due, in what order".
// Pure module (no React Native imports) so scripts/schedule.test.ts can run it under node.
// Source of "last done" = the existing service_records; no extra table.
import type { ServiceType } from '../types';

export type ScheduledType = Exclude<ServiceType, 'other'>;

interface Interval {
  km?: number;
  months?: number;
  costMxn: number;
  label: string;
}

// ponytail: generic Mexican-market intervals + rough costs — one table, not per-make/model.
// Refine (per-model, UMA-tuned) later, same as the CDMX data. Tune freely.
export const SERVICE_INTERVALS: Record<ScheduledType, Interval> = {
  oil_change:    { km: 7500,  months: 6,  costMxn: 700,  label: 'Cambio de aceite' },
  tire_rotation: { km: 10000,             costMxn: 350,  label: 'Rotación de llantas' },
  air_filter:    { km: 15000,             costMxn: 350,  label: 'Filtro de aire' },
  alignment:     { km: 20000,             costMxn: 500,  label: 'Alineación y balanceo' },
  brake_service: { km: 40000,             costMxn: 1200, label: 'Balatas / frenos' },
  spark_plugs:   { km: 40000,             costMxn: 900,  label: 'Bujías / afinación' },
  coolant:       { km: 40000, months: 24, costMxn: 600,  label: 'Anticongelante' },
  battery:       {            months: 36, costMxn: 2000, label: 'Batería' },
  transmission:  { km: 60000,             costMxn: 1500, label: 'Aceite de transmisión' },
  inspection:    { km: 10000, months: 6,  costMxn: 500,  label: 'Revisión general' },
};

export interface ServiceRecordLike {
  service_date: string;        // YYYY-MM-DD
  mileage_at_service: number;
  services: string[];
}

export interface ScheduleItem {
  type: ScheduledType;
  label: string;
  status: 'due' | 'soon' | 'ok';
  dueInKm: number | null;      // negative = overdue
  dueInDays: number | null;
  estCostMxn: number;
  neverLogged: boolean;
}

export interface ScheduleOpts {
  updatedAt?: string;          // cars.updated_at — used to estimate current km when stale
  avgKmPerDay?: number;        // default ~1,000 km/month
}

const DAY = 86400000;
const SOON_KM = 1500;
const SOON_DAYS = 30;

// Estimate "real" mileage today: she rarely updates it, so add ~33 km/day since last update.
export function effectiveMileage(currentMileage: number, today: Date, opts?: ScheduleOpts): number {
  if (!opts?.updatedAt) return currentMileage;
  const days = Math.max(0, (today.getTime() - new Date(opts.updatedAt).getTime()) / DAY);
  return Math.round(currentMileage + (opts.avgKmPerDay ?? 33) * days);
}

export function computeSchedule(
  records: ServiceRecordLike[],
  currentMileage: number,
  today: Date,
  opts?: ScheduleOpts,
): ScheduleItem[] {
  const km = effectiveMileage(currentMileage, today, opts);

  const items: ScheduleItem[] = (Object.keys(SERVICE_INTERVALS) as ScheduledType[]).map((type) => {
    const iv = SERVICE_INTERVALS[type];
    const recs = records
      .filter((r) => Array.isArray(r.services) && r.services.includes(type))
      .sort((a, b) => b.service_date.localeCompare(a.service_date));
    const last = recs[0];

    if (!last) {
      return { type, label: iv.label, status: 'due', dueInKm: null, dueInDays: null, estCostMxn: iv.costMxn, neverLogged: true };
    }

    let dueInKm: number | null = null;
    let dueInDays: number | null = null;
    if (iv.km != null) dueInKm = (last.mileage_at_service + iv.km) - km;
    if (iv.months != null) {
      const next = new Date(last.service_date + 'T00:00:00');
      next.setMonth(next.getMonth() + iv.months);
      dueInDays = Math.ceil((next.getTime() - today.getTime()) / DAY);
    }

    const isDue = (dueInKm != null && dueInKm <= 0) || (dueInDays != null && dueInDays <= 0);
    const isSoon = (dueInKm != null && dueInKm <= SOON_KM) || (dueInDays != null && dueInDays <= SOON_DAYS);
    const status: ScheduleItem['status'] = isDue ? 'due' : isSoon ? 'soon' : 'ok';

    return { type, label: iv.label, status, dueInKm, dueInDays, estCostMxn: iv.costMxn, neverLogged: false };
  });

  const rank = { due: 0, soon: 1, ok: 2 };
  return items.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    const ak = a.dueInKm ?? (a.dueInDays != null ? a.dueInDays * 33 : 1e9);
    const bk = b.dueInKm ?? (b.dueInDays != null ? b.dueInDays * 33 : 1e9);
    return ak - bk;
  });
}

// Human one-liner for a schedule item.
export function scheduleSummary(it: ScheduleItem): string {
  if (it.neverLogged) return 'Sin registro — conviene revisar';
  if (it.status === 'due') return '¡Toca ahora!';
  if (it.dueInKm != null && (it.dueInDays == null || it.dueInKm <= it.dueInDays * 33)) {
    return `En ~${Math.max(0, it.dueInKm).toLocaleString('es-MX')} km`;
  }
  if (it.dueInDays != null) return `En ~${Math.max(0, it.dueInDays)} días`;
  return '';
}

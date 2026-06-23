// Hoy No Circula (CDMX) — "¿puedo circular hoy?" engine.
// Source of truth for the rules; the daily-circulation edge function mirrors this logic.
// Refs: SEDEMA programa Hoy No Circula 2026.

export type Hologram = '00' | '0' | '1' | '2' | 'exento' | 'foreign';

export interface HNCInput {
  plateLastDigit: number;            // 0–9
  hologram: Hologram;
  isElectricHybrid?: boolean;
  isMoto?: boolean;
  date: Date;
  contingenciaPhase?: 0 | 1 | 2;     // 0 = none
}

export interface HNCResult {
  restricted: boolean;
  reason: string;
}

// Weekday (Mon=1 … Fri=5) → plate last digits that rest that day.
const WEEKDAY_DIGITS: Record<number, number[]> = {
  1: [5, 6], // Lunes
  2: [7, 8], // Martes
  3: [3, 4], // Miércoles
  4: [1, 2], // Jueves
  5: [9, 0], // Viernes
};

const DAY_NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function nthWeekdayOfMonth(d: Date): number {
  return Math.ceil(d.getDate() / 7); // 1..5
}

export function canCirculateToday(i: HNCInput): HNCResult {
  const day = i.date.getDay(); // 0=Sun … 6=Sat
  const digit = i.plateLastDigit;
  const exemptVehicle = !!i.isElectricHybrid || !!i.isMoto || i.hologram === 'exento';

  // Sunday: always free.
  if (day === 0) return { restricted: false, reason: 'Domingo: circulas.' };

  let restricted = false;
  let reason = 'Hoy circulas. ✓';

  if (!exemptVehicle) {
    if (day >= 1 && day <= 5) {
      // Weekday restriction applies to holograma 1, 2, and foreign plates only.
      if ((i.hologram === '1' || i.hologram === '2' || i.hologram === 'foreign')
          && WEEKDAY_DIGITS[day].includes(digit)) {
        restricted = true;
        reason = `Hoy no circula: terminación ${digit}, ${DAY_NAME[day]} 05:00–22:00.`;
      }
    } else if (day === 6) {
      // Saturday.
      if (i.hologram === '2' || i.hologram === 'foreign') {
        restricted = true;
        reason = 'Hoy no circula: holograma 2 descansa cada sábado.';
      } else if (i.hologram === '1') {
        const nth = nthWeekdayOfMonth(i.date);
        const restSaturdays = digit % 2 === 1 ? [1, 3] : [2, 4]; // odd plate → 1er/3er; even → 2do/4to
        if (restSaturdays.includes(nth)) {
          restricted = true;
          reason = `Hoy no circula: holograma 1, ${nth}º sábado del mes.`;
        }
      }
    }
  }

  // Contingencia ambiental overlay.
  // ponytail: simplified — CAMe publishes the exact parity per event; drive it from app_config later.
  const phase = i.contingenciaPhase ?? 0;
  if (phase >= 1 && !restricted) {
    if (i.hologram === '2' || i.hologram === 'foreign') {
      restricted = true;
      reason = 'Contingencia ambiental: holograma 2 no circula.';
    } else if (i.hologram === '0' || i.hologram === '00') {
      const plateEven = digit % 2 === 0;
      const dayEven = i.date.getDate() % 2 === 0;
      if (plateEven === dayEven) {
        restricted = true;
        reason = 'Contingencia ambiental: restricción por terminación de placa.';
      }
    }
  }

  return { restricted, reason };
}

// Extract the last numeric digit from a Mexican plate string.
export function plateLastDigit(plates?: string): number | null {
  if (!plates) return null;
  const digits = plates.replace(/[^0-9]/g, '');
  return digits ? Number(digits.slice(-1)) : null;
}

// Hoy No Circula rules for edge functions — pure, no Deno imports, so
// scripts/hnc-parity.test.ts can import it and assert it never drifts from
// the mobile source of truth (apps/mobile/lib/hoyNoCircula.ts).

const WEEKDAY: Record<number, number[]> = { 1: [5, 6], 2: [7, 8], 3: [3, 4], 4: [1, 2], 5: [9, 0] };

export function plateLastDigit(plates?: string): number | null {
  if (!plates) return null;
  const digits = plates.replace(/[^0-9]/g, '');
  return digits ? Number(digits.slice(-1)) : null;
}

export function restrictedToday(digit: number, holo: string, electric: boolean, moto: boolean, date: Date, phase: number): boolean {
  const day = date.getDay();
  if (day === 0) return false;
  const h = holo === 'doble_cero' ? '00' : holo;
  const exempt = electric || moto || h === 'exento';

  let restricted = false;
  if (!exempt) {
    if (day >= 1 && day <= 5) {
      if ((h === '1' || h === '2' || h === 'foreign') && WEEKDAY[day].includes(digit)) restricted = true;
    } else if (day === 6) {
      if (h === '2' || h === 'foreign') restricted = true;
      else if (h === '1') {
        const nth = Math.ceil(date.getDate() / 7);
        const rest = digit % 2 === 1 ? [1, 3] : [2, 4];
        if (rest.includes(nth)) restricted = true;
      }
    }
  }
  if (phase >= 1 && !restricted) {
    if (h === '2' || h === 'foreign') restricted = true;
    else if (h === '0' || h === '00') {
      if ((digit % 2 === 0) === (date.getDate() % 2 === 0)) restricted = true;
    }
  }
  return restricted;
}

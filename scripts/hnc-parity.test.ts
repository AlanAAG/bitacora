// Drift guard: the edge-function Hoy No Circula mirror must agree with the
// mobile source of truth for every input. Run: node scripts/hnc-parity.test.ts
import assert from 'node:assert/strict';
import { canCirculateToday, plateLastDigit as mobilePlateLastDigit, type Hologram } from '../apps/mobile/lib/hoyNoCircula.ts';
import { restrictedToday, plateLastDigit } from '../supabase/functions/_shared/hnc.ts';

const HOLOGRAMS: Hologram[] = ['00', '0', '1', '2', 'exento', 'foreign'];
let cases = 0;

// Full June 2026 (has 1st–5th Saturdays and Sundays) × every digit/hologram/flag/phase.
for (let dayOfMonth = 1; dayOfMonth <= 30; dayOfMonth++) {
  const date = new Date(`2026-06-${String(dayOfMonth).padStart(2, '0')}T12:00:00`);
  for (let digit = 0; digit <= 9; digit++) {
    for (const hologram of HOLOGRAMS) {
      for (const electric of [false, true]) {
        for (const moto of [false, true]) {
          for (const phase of [0, 1, 2] as const) {
            const mobile = canCirculateToday({
              plateLastDigit: digit, hologram, isElectricHybrid: electric, isMoto: moto,
              date, contingenciaPhase: phase,
            }).restricted;
            const edge = restrictedToday(digit, hologram, electric, moto, date, phase);
            assert.equal(edge, mobile,
              `drift: digit=${digit} holo=${hologram} electric=${electric} moto=${moto} date=2026-06-${dayOfMonth} phase=${phase} (edge=${edge}, mobile=${mobile})`);
            cases++;
          }
        }
      }
    }
  }
}

// DB stores 'doble_cero'; the edge mirror must treat it as '00'.
const d = new Date('2026-06-20T12:00:00');
assert.equal(restrictedToday(5, 'doble_cero', false, false, d, 0), restrictedToday(5, '00', false, false, d, 0));

// plateLastDigit parity.
for (const p of [undefined, '', 'ABC-123', 'XYZ', 'NHK-92-71', '5']) {
  assert.equal(plateLastDigit(p), mobilePlateLastDigit(p), `plateLastDigit drift for ${p}`);
}

console.log(`OK: edge/mobile Hoy No Circula parity holds (${cases} cases)`);

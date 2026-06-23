// Runnable check for the Hoy No Circula engine. Run: node scripts/hnc.test.ts
import assert from 'node:assert/strict';
import { canCirculateToday, plateLastDigit } from '../apps/mobile/lib/hoyNoCircula.ts';

const d = (s: string) => new Date(s + 'T12:00:00');
const r = (i: any) => canCirculateToday(i).restricted;

// Weekday restriction (Wed = digits 3,4) applies to holograma 1/2/foreign only.
assert.equal(r({ plateLastDigit: 4, hologram: '2', date: d('2026-06-17') }), true,  'Wed digit-4 holo-2 restricted');
assert.equal(r({ plateLastDigit: 4, hologram: '0', date: d('2026-06-17') }), false, 'holo-0 exempt on weekdays');
assert.equal(r({ plateLastDigit: 4, hologram: '2', date: d('2026-06-17'), isElectricHybrid: true }), false, 'electric exempt');
assert.equal(r({ plateLastDigit: 7, hologram: '1', date: d('2026-06-15') }), false, 'Mon needs digit 5/6, not 7');
assert.equal(r({ plateLastDigit: 5, hologram: '1', date: d('2026-06-15') }), true,  'Mon digit-5 holo-1 restricted');

// Sunday always free.
assert.equal(r({ plateLastDigit: 5, hologram: '2', date: d('2026-06-21') }), false, 'Sunday free');

// Saturday: holograma 1 parity, holograma 2 every Saturday, holograma 0 free.
assert.equal(r({ plateLastDigit: 5, hologram: '1', date: d('2026-06-20') }), true,  'odd plate rests 3rd Sat');
assert.equal(r({ plateLastDigit: 5, hologram: '1', date: d('2026-06-13') }), false, 'odd plate circulates 2nd Sat');
assert.equal(r({ plateLastDigit: 4, hologram: '1', date: d('2026-06-13') }), true,  'even plate rests 2nd Sat');
assert.equal(r({ plateLastDigit: 1, hologram: '2', date: d('2026-06-20') }), true,  'holo-2 rests every Sat');
assert.equal(r({ plateLastDigit: 1, hologram: '0', date: d('2026-06-20') }), false, 'holo-0 free Sat');

// Contingencia overlay.
assert.equal(r({ plateLastDigit: 6, hologram: '2', date: d('2026-06-15'), contingenciaPhase: 1 }), true, 'contingencia stops holo-2');
assert.equal(r({ plateLastDigit: 4, hologram: '0', date: d('2026-06-16'), contingenciaPhase: 1 }), true, 'contingencia parity stops even plate on even day');

// plate parsing
assert.equal(plateLastDigit('ABC-256'), 6);
assert.equal(plateLastDigit('AB-12-CD'), 2);
assert.equal(plateLastDigit(undefined), null);

console.log('OK: Hoy No Circula engine passes');

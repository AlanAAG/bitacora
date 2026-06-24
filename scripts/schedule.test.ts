// Runnable check for the maintenance-schedule engine. Run: node scripts/schedule.test.ts
import assert from 'node:assert/strict';
import { computeSchedule, effectiveMileage } from '../apps/mobile/lib/maintenanceSchedule.ts';

const today = new Date('2026-06-23T12:00:00');
const rec = (date: string, km: number, services: string[]) => ({ service_date: date, mileage_at_service: km, services });
const find = (items: any[], type: string) => items.find((i) => i.type === type);

// Never logged -> due.
let s = computeSchedule([], 60000, today);
assert.equal(find(s, 'oil_change').status, 'due', 'never logged oil = due');
assert.equal(find(s, 'oil_change').neverLogged, true);

// Oil logged at 55,000; current 60,000; interval 7,500 -> next 62,500 -> 2,500 left -> ok.
s = computeSchedule([rec('2026-05-01', 55000, ['oil_change'])], 60000, today);
assert.equal(find(s, 'oil_change').status, 'ok', '2500 km left = ok');
assert.equal(find(s, 'oil_change').dueInKm, 2500);

// Current 61,000 -> 1,500 left -> soon.
s = computeSchedule([rec('2026-05-01', 55000, ['oil_change'])], 61000, today);
assert.equal(find(s, 'oil_change').status, 'soon', '1500 km left = soon');

// Current 63,000 -> overdue -> due.
s = computeSchedule([rec('2026-05-01', 55000, ['oil_change'])], 63000, today);
assert.equal(find(s, 'oil_change').status, 'due', 'overdue = due');
assert.ok(find(s, 'oil_change').dueInKm < 0);

// Battery is time-only (36 mo). Logged 4 years ago -> due.
s = computeSchedule([rec('2022-06-01', 40000, ['battery'])], 60000, today);
assert.equal(find(s, 'battery').status, 'due', 'old battery = due');

// Stale-mileage estimate flips ok -> soon.
// oil last @55k, actual current 60k (ok), but updated 60 days ago -> +~1,980 km -> ~61,980 -> ~520 left -> soon.
const stale = computeSchedule([rec('2026-05-01', 55000, ['oil_change'])], 60000, today, { updatedAt: '2026-04-24' });
assert.equal(find(stale, 'oil_change').status, 'soon', 'stale mileage estimate flips to soon');
assert.ok(effectiveMileage(60000, today, { updatedAt: '2026-04-24' }) > 61000, 'estimate adds km');

// Sorted: due items before ok items.
s = computeSchedule([rec('2026-05-01', 55000, ['oil_change'])], 60000, today);
assert.equal(s[0].status === 'due', true, 'most urgent first');

console.log('OK: maintenance schedule engine passes');

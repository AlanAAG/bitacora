// Runnable self-check for the two pure heuristics used by the edge functions.
// Mirrors the arithmetic in supabase/functions/{maintenance-agent,guard-agent}/index.ts.
// Run: node scripts/scoring.test.mjs
import assert from 'node:assert/strict';

// --- maintenance-agent: computeHealthScore arithmetic ---
function healthScore({ reminders = 0, wornParts = 0, expiredDocs = 0 } = {}) {
  let score = 100;
  score -= Math.min(30, reminders * 10);
  score -= 15 * wornParts;
  score -= 20 * expiredDocs;
  return Math.max(0, score);
}

// --- guard-agent: estimateSavings ---
function estimateSavings(flags) {
  let total = 0;
  for (const f of flags) {
    if (f.severity === 'high') total += 1200;
    else if (f.severity === 'medium') total += 500;
    else total += 200;
  }
  return total;
}

// health score
assert.equal(healthScore(), 100, 'pristine car = 100');
assert.equal(healthScore({ reminders: 1 }), 90, 'one reminder = -10');
assert.equal(healthScore({ reminders: 10 }), 70, 'reminder penalty caps at 30');
assert.equal(healthScore({ wornParts: 2 }), 70, 'two worn parts = -30');
assert.equal(healthScore({ expiredDocs: 1 }), 80, 'one expired doc = -20');
assert.equal(healthScore({ reminders: 5, wornParts: 5, expiredDocs: 5 }), 0, 'never negative');

// savings
assert.equal(estimateSavings([]), 0, 'no flags = 0');
assert.equal(estimateSavings([{ severity: 'high' }]), 1200);
assert.equal(estimateSavings([{ severity: 'medium' }, { severity: 'low' }]), 700);

console.log('OK: scoring heuristics pass');

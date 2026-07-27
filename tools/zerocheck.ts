/**
 * Measures how often, and for how long, a player's cash sits pinned at zero.
 *
 * Reported from play as "you randomly get set to zero". Two mechanisms can do
 * it: a single bad event outcome draining the balance, and the emergency
 * credit line confiscating surplus cash every tick.
 *
 *   npx tsx tools/zerocheck.ts
 */
import { createInitialState } from '../src/engine/state';
import { createRuntime, step } from '../src/engine/sim';
import { apply } from '../src/engine/actions';
import { CATEGORIES } from '../src/engine/content/businesses';
import { businessCost, isCategoryUnlocked, upgradeCost } from '../src/engine/selectors';

const TRIALS = Number(process.env.TRIALS ?? 6);
const MINUTES = 40;

let totalZeroSeconds = 0;
let totalWipes = 0;
let totalSeconds = 0;
let worstDrop = 0;

for (let trial = 0; trial < TRIALS; trial++) {
  const s = createInitialState();
  const rt = createRuntime();
  let zeroSeconds = 0;
  let wipes = 0;
  let wasZero = false;

  for (let t = 0; t < MINUTES * 60; t += 0.5) {
    const before = s.cash;
    step(s, 0.5, rt);

    // Play every card, picking the greedier option half the time — a normal
    // player takes risks.
    for (const ev of [...s.pendingEvents]) {
      apply(s, { type: 'resolveEvent', eventUid: ev.uid, choiceIndex: Math.random() < 0.5 ? 0 : 1 });
    }
    while (s.rollTokens > 0) apply(s, { type: 'roll' });

    // Reinvest, but keep a modest buffer like a real player would.
    if (Math.round(t * 2) % 20 === 0) {
      for (const def of CATEGORIES) {
        if (isCategoryUnlocked(s, def) && s.cash > businessCost(s, def) * 1.5) {
          apply(s, { type: 'buyBusiness', category: def.id });
        }
      }
      for (const b of [...s.businesses]) {
        if (s.cash > upgradeCost(s, b) * 2) apply(s, { type: 'upgradeBusiness', id: b.id });
      }
    }

    if (before > 0) {
      const drop = (before - s.cash) / before;
      if (drop > worstDrop) worstDrop = drop;
    }

    const nearZero = s.cash < 1;
    if (nearZero) {
      zeroSeconds += 0.5;
      if (!wasZero) wipes++;
    }
    wasZero = nearZero;
    totalSeconds += 0.5;
  }

  totalZeroSeconds += zeroSeconds;
  totalWipes += wipes;
}

console.log(`across ${TRIALS} runs of ${MINUTES} min each:`);
console.log(`  time with cash pinned at ~0 : ${(100 * totalZeroSeconds / totalSeconds).toFixed(1)}%`);
console.log(`  times cash hit ~0           : ${totalWipes} (${(totalWipes / TRIALS).toFixed(1)} per run)`);
console.log(`  worst single-tick cash drop : ${(worstDrop * 100).toFixed(1)}% of balance`);

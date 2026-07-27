import { createInitialState } from '../src/engine/state';
import { createRuntime, step } from '../src/engine/sim';
import { apply } from '../src/engine/actions';
import { CATEGORIES } from '../src/engine/content/businesses';
import {
  businessCost, isCategoryUnlocked, netWorth, upgradeCost, hireStaffCost, maxStaff,
} from '../src/engine/selectors';

/** One run of an optimal-reinvestment bot. Returns seconds to $50M. */
function run(): { seconds: number; businesses: number; decisions: number } {
  const s = createInitialState();
  const rt = createRuntime();
  const DT = 0.5;
  const MAX = 8 * 3600;

  for (let t = 0; t < MAX; t += DT) {
    step(s, DT, rt);
    for (const ev of [...s.pendingEvents]) {
      apply(s, { type: 'resolveEvent', eventUid: ev.uid, choiceIndex: 0 });
    }
    while (s.rollTokens > 0) apply(s, { type: 'roll' });

    if (Math.round(t * 2) % 10 === 0) {
      for (const def of CATEGORIES) {
        if (!isCategoryUnlocked(s, def)) continue;
        if (s.cash > businessCost(s, def) * 1.6) apply(s, { type: 'buyBusiness', category: def.id });
      }
      for (const b of [...s.businesses]) {
        if (s.cash > upgradeCost(s, b) * 2.5) apply(s, { type: 'upgradeBusiness', id: b.id });
        if (b.staff < maxStaff(b) && s.cash > hireStaffCost(s, b) * 3) {
          apply(s, { type: 'hireStaff', id: b.id });
        }
      }
    }
    if (netWorth(s) >= Number(process.env.GOAL ?? 50_000_000)) {
      return { seconds: t, businesses: s.businesses.length, decisions: s.stats.eventsResolved };
    }
  }
  return { seconds: MAX, businesses: s.businesses.length, decisions: s.stats.eventsResolved };
}

const TRIALS = Number(process.env.TRIALS ?? 7);
const results = Array.from({ length: TRIALS }, run);
const times = results.map((r) => r.seconds).sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)];
const mean = times.reduce((a, b) => a + b, 0) / times.length;
const m = (x: number) => `${(x / 60).toFixed(1)}m`;

console.log(
  `median ${m(median)} | mean ${m(mean)} | min ${m(times[0])} | max ${m(times[times.length - 1])} ` +
  `| businesses ~${Math.round(results.reduce((a, r) => a + r.businesses, 0) / TRIALS)} ` +
  `| decisions ~${Math.round(results.reduce((a, r) => a + r.decisions, 0) / TRIALS)}`,
);

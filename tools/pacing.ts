/**
 * Headless pacing harness.
 *
 * Drives the engine with a "good player" policy — one that reinvests into
 * whichever option has the shortest payback period rather than buying
 * indiscriminately — and reports how long it takes to reach the IPO threshold.
 *
 *   npx tsx tools/pacing.ts
 *   GOAL=50000000 TRIALS=11 npx tsx tools/pacing.ts
 */
import { createInitialState } from '../src/engine/state';
import { createRuntime, step } from '../src/engine/sim';
import { apply } from '../src/engine/actions';
import { CATEGORIES } from '../src/engine/content/businesses';
import { DEVELOPMENT_OPTIONS } from '../src/engine/content/realestate';
import { TUNING } from '../src/engine/content/tuning';
import {
  businessCost,
  businessFinancials,
  empireIncomeMultiplier,
  hireStaffCost,
  isCategoryUnlocked,
  maxStaff,
  netWorth,
  nextSaturation,
  propertyValue,
  propertyYield,
  upgradeCost,
} from '../src/engine/selectors';
import { offersFor, traitRevenueMultiplier, traitUpkeepDelta } from '../src/engine/premises';
import type { GameState } from '../src/engine/types';

/** Only reinvest when the purchase pays for itself within this many seconds. */
const MAX_PAYBACK = 3000;

interface Buy {
  payback: number;
  cost: number;
  kind: string;
  run: () => void;
}

/** Every purchase available right now, scored by payback period. */
function options(s: GameState): Buy[] {
  const out: Buy[] = [];
  const mult = empireIncomeMultiplier(s);

  for (const def of CATEGORIES) {
    if (!isCategoryUnlocked(s, def)) continue;
    const standard = businessCost(s, def);
    // Each premises on the shortlist is its own option: traits move both the
    // asking price and the revenue, so the bot has to price them individually
    // rather than assume the category's list price. Scoring only the standard
    // cost would let it buy an expensive site at a bargain's payback and
    // report a run faster than any real one.
    for (const offer of offersFor(s, def.id)) {
      const cost = standard * offer.priceMultiplier;
      const margin = 1 - def.upkeepRatio - traitUpkeepDelta(offer.traits) - TUNING.rentRatio;
      const net =
        def.baseRevenue *
        nextSaturation(s, def.id) *
        traitRevenueMultiplier(offer.traits) *
        margin *
        mult;
      if (net > 0) {
        out.push({
          payback: cost / net,
          cost,
          kind: 'business',
          run: () => apply(s, { type: 'buyBusiness', category: def.id, offerId: offer.id }),
        });
      }
    }
  }

  for (const b of s.businesses) {
    const before = businessFinancials(s, b).net;
    const cost = upgradeCost(s, b);
    // An upgrade multiplies this business's revenue by revenuePerLevel.
    const gain = before * (TUNING.revenuePerLevel - 1);
    if (gain > 0) {
      out.push({ payback: cost / gain, cost, kind: 'upgrade', run: () => apply(s, { type: 'upgradeBusiness', id: b.id }) });
    }

    if (b.roster.length < maxStaff(b)) {
      const staffCost = hireStaffCost(s, b);
      const staffGain = before * TUNING.staffRevenueBonus;
      if (staffGain > 0) {
        out.push({
          payback: staffCost / staffGain,
          cost: staffCost,
          kind: 'staff',
          run: () => apply(s, { type: 'hireStaff', id: b.id }),
        });
      }
    }
  }

  // Buying a commercial unit to house a business removes that business's rent
  // and widens its margin — usually property's strongest use, and the reason
  // raw rental yield alone understates it badly.
  const unhoused = s.businesses.filter((b) => b.propertyId === null);
  for (const p of s.properties) {
    if (p.owned || p.kind !== 'commercial') continue;
    const value = propertyValue(s, p);
    for (const b of unhoused) {
      const fin = businessFinancials(s, b);
      const gain = fin.rent + fin.gross * TUNING.ownedPropertyMarginBonus;
      if (gain <= 0) continue;
      out.push({
        payback: value / gain,
        cost: value,
        kind: 'housing',
        run: () => {
          apply(s, { type: 'buyProperty', propertyId: p.id });
          apply(s, { type: 'assignProperty', businessId: b.id, propertyId: p.id });
        },
      });
    }
  }

  // Property: rental yield, and development on owned land.
  for (const p of s.properties) {
    const value = propertyValue(s, p);
    if (!p.owned) {
      const rent = (value * propertyYield(p)) / TUNING.secondsPerGameYear;
      if (rent > 0) {
        out.push({ payback: value / rent, cost: value, kind: 'property', run: () => apply(s, { type: 'buyProperty', propertyId: p.id }) });
      }
      continue;
    }
    if (p.kind === 'land' && !p.development && !p.developedType) {
      for (const dev of DEVELOPMENT_OPTIONS) {
        const cost = value * dev.costRatio;
        const rent = (value * dev.valueMultiplier * dev.yieldBonus) / TUNING.secondsPerGameYear;
        out.push({
          payback: cost / rent + dev.buildSeconds,
          cost,
          kind: 'develop',
          run: () => apply(s, { type: 'developProperty', propertyId: p.id, devType: dev.type }),
        });
      }
    }
  }

  return out;
}

const tally: Record<string, number> = {};

function run(goal: number) {
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

    // Reinvest every 5s into the best-payback options affordable, keeping a
    // buffer. A real player is slower and less consistent than this.
    if (Math.round(t * 2) % 10 === 0) {
      for (let i = 0; i < 6; i++) {
        const best = options(s)
          .filter((o) => o.cost <= s.cash * 0.8 && o.payback < MAX_PAYBACK)
          .sort((a, b) => a.payback - b.payback)[0];
        if (!best) break;
        tally[best.kind] = (tally[best.kind] ?? 0) + 1;
        best.run();
      }
    }

    if (netWorth(s) >= goal) return snapshot(s, t);
  }
  return snapshot(s, MAX);
}

function snapshot(s: GameState, seconds: number) {
  return {
    seconds,
    businesses: s.businesses.length,
    properties: s.properties.filter((p) => p.owned).length,
    decisions: s.stats.eventsResolved,
  };
}

const GOAL = Number(process.env.GOAL ?? TUNING.ipoMinNetWorth);
const TRIALS = Number(process.env.TRIALS ?? 7);

const results = Array.from({ length: TRIALS }, () => run(GOAL));
const times = results.map((r) => r.seconds).sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)];
const mean = times.reduce((a, b) => a + b, 0) / times.length;
const avg = (key: 'businesses' | 'properties' | 'decisions') =>
  Math.round(results.reduce((a, r) => a + r[key], 0) / TRIALS);
const m = (x: number) => `${(x / 60).toFixed(1)}m`;

console.log('purchases across all trials:', tally);
const last = createInitialState();
void last;
console.log(
  `median ${m(median)} | mean ${m(mean)} | min ${m(times[0])} | max ${m(times[times.length - 1])} ` +
    `| businesses ~${avg('businesses')} | properties ~${avg('properties')} | decisions ~${avg('decisions')}`,
);

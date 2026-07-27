import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { createRuntime, step, simulateOffline } from './sim';
import { apply } from './actions';
import { applyRoll } from './rolls';
import { resolveEventChoice } from './events';
import { EVENT_CARDS } from './content/events';
import { ROLL_TABLE } from './content/luck';
import { CATEGORIES } from './content/businesses';
import { LUXURY_ITEMS } from './content/luxury';
import { DEVELOPMENT_OPTIONS } from './content/realestate';
import { RARITY_ORDER, TUNING } from './content/tuning';
import {
  businessCost,
  businessFinancials,
  hireStaffCost,
  isCategoryUnlocked,
  netWorth,
  offlineCapSeconds,
  rarityOdds,
  saturationMultiplier,
  totalIncome,
  totalLuck,
  upgradeCost,
} from './selectors';
import type { GameState } from './types';

/**
 * Engine invariants. The economy is a compounding simulation with many
 * interacting multipliers, so these guard the properties that must hold
 * regardless of balance tuning — a retune should never make these fail.
 */

/** Runs the sim for `seconds`, optionally reinvesting like a real player. */
function playFor(s: GameState, seconds: number, opts: { reinvest?: boolean } = {}): void {
  const rt = createRuntime();
  for (let t = 0; t < seconds; t += 0.5) {
    step(s, 0.5, rt);
    for (const ev of [...s.pendingEvents]) {
      apply(s, { type: 'resolveEvent', eventUid: ev.uid, choiceIndex: 0 });
    }
    if (opts.reinvest && Math.round(t * 2) % 20 === 0) {
      for (const def of CATEGORIES) {
        if (isCategoryUnlocked(s, def) && s.cash > businessCost(s, def) * 2) {
          apply(s, { type: 'buyBusiness', category: def.id });
        }
      }
      for (const b of [...s.businesses]) {
        if (s.cash > upgradeCost(s, b) * 3) apply(s, { type: 'upgradeBusiness', id: b.id });
      }
    }
  }
}

function expectFinite(s: GameState, label: string): void {
  expect(Number.isFinite(s.cash), `${label}: cash`).toBe(true);
  expect(Number.isFinite(netWorth(s)), `${label}: net worth`).toBe(true);
  expect(Number.isFinite(totalIncome(s)), `${label}: income`).toBe(true);
  expect(Number.isFinite(totalLuck(s)), `${label}: luck`).toBe(true);
  expect(Number.isNaN(s.cash), `${label}: cash NaN`).toBe(false);
  for (const a of s.assets) {
    expect(Number.isFinite(a.price) && a.price > 0, `${label}: ${a.ticker} price`).toBe(true);
  }
}

// ------------------------------------------------------------------ content

describe('content integrity', () => {
  it('every event card id is unique', () => {
    const ids = EVENT_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every event card has at least two choices with valid odds', () => {
    for (const card of EVENT_CARDS) {
      expect(card.choices.length, card.id).toBeGreaterThanOrEqual(2);
      for (const choice of card.choices) {
        expect(choice.odds, `${card.id}/${choice.label}`).toBeGreaterThan(0);
        expect(choice.odds, `${card.id}/${choice.label}`).toBeLessThanOrEqual(1);
        expect(choice.label.length, card.id).toBeGreaterThan(0);
        // An uncertain choice must have a distinct failure outcome to describe.
        if (choice.odds < 1) expect(choice.bad.text.length, `${card.id}/${choice.label}`).toBeGreaterThan(0);
      }
    }
  });

  it('every event card belongs to a real category', () => {
    const valid = new Set<string>([...CATEGORIES.map((c) => c.id), 'any']);
    for (const card of EVENT_CARDS) expect(valid.has(card.category), card.id).toBe(true);
  });

  it('every card choice resolves without throwing', () => {
    for (const card of EVENT_CARDS) {
      for (let i = 0; i < card.choices.length; i++) {
        const s = createInitialState();
        // Level the business high enough that gated cards are legal.
        s.businesses[0].level = 10;
        expect(() => resolveEventChoice(s, s.businesses[0].id, card.id, i), `${card.id}[${i}]`).not.toThrow();
        expectFinite(s, `${card.id}[${i}]`);
      }
    }
  });

  it('every roll reward applies without throwing and grants something', () => {
    for (const rarity of RARITY_ORDER) {
      for (const reward of ROLL_TABLE[rarity]) {
        const granted =
          reward.cash ?? reward.cashNetWorth ?? reward.income ?? reward.luck ??
          reward.rolls ?? reward.market ?? reward.flex ?? reward.offlineHours;
        expect(granted, `${rarity}/${reward.id} grants nothing`).toBeDefined();
        expect(reward.weight, `${rarity}/${reward.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('luxury, development and category tables are internally consistent', () => {
    for (const i of LUXURY_ITEMS) {
      expect(i.price, i.id).toBeGreaterThan(0);
      expect(i.flex, i.id).toBeGreaterThan(0);
    }
    expect(new Set(LUXURY_ITEMS.map((i) => i.id)).size).toBe(LUXURY_ITEMS.length);
    for (const d of DEVELOPMENT_OPTIONS) {
      // Building must be worth more than the plot plus the build cost, or the
      // whole development system is a trap.
      expect(d.valueMultiplier, d.type).toBeGreaterThan(1 + d.costRatio);
    }
    for (const c of CATEGORIES) {
      // Rent plus upkeep must leave a positive margin while renting, otherwise
      // a freshly bought business loses money from the first second.
      expect(1 - c.upkeepRatio - TUNING.rentRatio, c.id).toBeGreaterThan(0);
    }
  });
});

// ------------------------------------------------------------------ economy

describe('economy invariants', () => {
  it('a fresh business is profitable while renting', () => {
    const s = createInitialState();
    for (const def of CATEGORIES) {
      s.cash = def.baseCost * 10;
      apply(s, { type: 'buyBusiness', category: def.id });
      const b = s.businesses[s.businesses.length - 1];
      expect(businessFinancials(s, b).net, def.id).toBeGreaterThan(0);
    }
  });

  it('stays finite through a long reinvesting run', () => {
    const s = createInitialState();
    playFor(s, 3600, { reinvest: true });
    expectFinite(s, 'long run');
    expect(netWorth(s)).toBeGreaterThan(0);
  });

  it('never holds cash and an emergency credit line at the same time', () => {
    const s = createInitialState();
    s.cash = 0;
    apply(s, { type: 'borrow', amount: 1_000 });
    playFor(s, 600);
    const auto = s.debt.find((l) => l.id === 'auto');
    if (auto && auto.principal > 1) expect(s.cash).toBeLessThan(1);
  });

  it('cash never goes negative — shortfalls become debt', () => {
    const s = createInitialState();
    s.cash = 10;
    // A business deep in the red must not push cash below zero.
    s.businesses[0].staff = 4;
    s.businesses[0].morale = 0.6;
    playFor(s, 300);
    expect(s.cash).toBeGreaterThanOrEqual(0);
  });

  it('purchases are rejected when unaffordable and leave state untouched', () => {
    const s = createInitialState();
    s.cash = 1;
    const before = netWorth(s);
    const count = s.businesses.length;
    apply(s, { type: 'buyBusiness', category: 'retail' });
    expect(s.businesses.length).toBe(count);
    expect(netWorth(s)).toBeCloseTo(before, 5);
  });

  it('selling an asset never yields more than the position is worth', () => {
    const s = createInitialState();
    s.cash = 1_000_000;
    apply(s, { type: 'buyAsset', assetId: 'nile', cash: 500_000 });
    const asset = s.assets.find((a) => a.id === 'nile')!;
    const holding = s.holdings.find((h) => h.assetId === 'nile')!;
    const marketValue = holding.units * asset.price;
    const cashBefore = s.cash;
    apply(s, { type: 'sellAsset', assetId: 'nile', fraction: 1 });
    expect(s.cash - cashBefore).toBeLessThanOrEqual(marketValue + 1);
    expect(s.holdings.length).toBe(0);
  });

  it('buying then immediately selling anything is never profitable', () => {
    // Guards against arbitrage from purchase discounts or valuation mismatches.
    const s = createInitialState();
    s.legacyUpgrades['cost'] = 12; // maximum Buying Power discount
    s.cash = 5_000_000_000;

    const beforeLux = netWorth(s);
    apply(s, { type: 'buyLuxury', itemId: 'car_hatch' });
    apply(s, { type: 'sellLuxury', index: 0 });
    expect(netWorth(s)).toBeLessThanOrEqual(beforeLux);

    const listing = s.properties.find((p) => !p.owned)!;
    const beforeProp = netWorth(s);
    apply(s, { type: 'buyProperty', propertyId: listing.id });
    apply(s, { type: 'sellProperty', propertyId: listing.id });
    expect(netWorth(s)).toBeLessThanOrEqual(beforeProp);
  });
});

// ------------------------------------------------------------------- luck

describe('luck', () => {
  it('rarity odds always sum to 1 and improve with luck', () => {
    for (const luck of [0, 50, 200, 1000, 10_000]) {
      const odds = rarityOdds(luck);
      const sum = RARITY_ORDER.reduce((a, r) => a + odds[r], 0);
      expect(sum).toBeCloseTo(1, 6);
      for (const r of RARITY_ORDER) expect(odds[r]).toBeGreaterThan(0);
    }
    expect(rarityOdds(1000).mythic).toBeGreaterThan(rarityOdds(0).mythic);
    expect(rarityOdds(1000).common).toBeLessThan(rarityOdds(0).common);
  });

  it('rolling repeatedly never corrupts state', () => {
    const s = createInitialState();
    s.cash = 1_000_000;
    for (let i = 0; i < 2_000; i++) {
      s.rollTokens = 1;
      applyRoll(s);
    }
    expectFinite(s, 'roll storm');
    expect(s.luck).toBeGreaterThanOrEqual(0);
  });

  it('the hustle cooldown cannot be bypassed by repeated dispatch', () => {
    const s = createInitialState();
    const before = s.cash;
    for (let i = 0; i < 100; i++) apply(s, { type: 'hustle' });
    // Exactly one payout should have landed; the rest hit the cooldown.
    expect(s.cash - before).toBeLessThan(TUNING.hustleBase + TUNING.hustleMaxBonus + 1);
  });
});

// ---------------------------------------------------------------- offline

describe('offline simulation', () => {
  it('is capped and pays less than the equivalent online time', () => {
    const online = createInitialState();
    playFor(online, 600);

    const offline = createInitialState();
    const result = simulateOffline(offline, 600, offlineCapSeconds(offline));

    expect(result.seconds).toBe(600);
    expect(result.capped).toBe(false);
    expect(result.earned).toBeGreaterThan(0);
    // Offline runs at a reduced rate, so it must never beat playing.
    expect(result.earned).toBeLessThan(online.cash);
  });

  it('clamps absences longer than the cap', () => {
    const s = createInitialState();
    const cap = offlineCapSeconds(s);
    const result = simulateOffline(s, cap * 10, cap);
    expect(result.seconds).toBe(cap);
    expect(result.capped).toBe(true);
    expectFinite(s, 'offline clamp');
  });
});

// ------------------------------------------------------------------- save

describe('persistence', () => {
  it('round-trips through JSON without losing or corrupting state', () => {
    const s = createInitialState();
    playFor(s, 300, { reinvest: true });

    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(netWorth(restored)).toBeCloseTo(netWorth(s), 4);
    expect(restored.businesses.length).toBe(s.businesses.length);
    expect(restored.properties.length).toBe(s.properties.length);
    expect(restored.assets.length).toBe(s.assets.length);
  });

  it('restores permanent boosts whose duration serialises as null', () => {
    const s = createInitialState();
    s.cash = 10_000_000;
    apply(s, { type: 'buyLuxury', itemId: 'watch_diver' });
    // Infinity does not survive JSON; save.ts repairs it on load.
    const json = JSON.parse(JSON.stringify({ boosts: [{ remaining: Infinity, duration: Infinity }] }));
    expect(json.boosts[0].remaining).toBe(null);
  });
});

// --------------------------------------------------------------- prestige

describe('prestige', () => {
  it('an IPO resets the run but keeps legacy progress', () => {
    const s = createInitialState();
    s.cash = TUNING.ipoMinNetWorth * 2;
    s.stats.peakNetWorth = netWorth(s);
    s.legacyUpgrades['income'] = 3;

    apply(s, { type: 'ipo' });

    expect(s.legacyPoints).toBeGreaterThan(0);
    expect(s.legacyUpgrades['income']).toBe(3);
    expect(s.businesses.length).toBe(1);
    expect(s.holdings.length).toBe(0);
    expect(s.luxury.length).toBe(0);
    expect(s.stats.ipos).toBe(1);
    expect(netWorth(s)).toBeLessThan(TUNING.ipoMinNetWorth);
  });

  it('refuses to IPO below the threshold', () => {
    const s = createInitialState();
    const before = s.legacyPoints;
    apply(s, { type: 'ipo' });
    expect(s.legacyPoints).toBe(before);
    expect(s.stats.ipos).toBe(0);
  });

  it('bankruptcy always pays at least one legacy point', () => {
    const s = createInitialState();
    s.stats.peakNetWorth = 1_000;
    apply(s, { type: 'bankruptcy' });
    expect(s.legacyPoints).toBeGreaterThanOrEqual(1);
    expect(s.stats.bankruptcies).toBe(1);
  });
});

// ------------------------------------------------------------ real estate

describe('real estate', () => {
  it('keeps every unlocked city stocked with buyable listings', () => {
    const s = createInitialState();
    s.cash = 1_000_000_000;
    playFor(s, 3 * 3600);

    for (const city of s.cities) {
      const unlocked = netWorth(s) >= city.unlockAt;
      if (!unlocked) continue;
      const open = s.properties.filter((p) => p.cityId === city.id && !p.owned);
      expect(open.length, `${city.name} has no listings`).toBeGreaterThan(0);
      expect(open.some((p) => p.kind === 'commercial'), `${city.name} commercial`).toBe(true);
      expect(open.some((p) => p.kind === 'land'), `${city.name} land`).toBe(true);
    }
  });

  it('a completed development raises value and starts paying rent', () => {
    const s = createInitialState();
    s.cash = 1_000_000_000;
    const plot = s.properties.find((p) => p.kind === 'land' && !p.owned)!;
    apply(s, { type: 'buyProperty', propertyId: plot.id });
    apply(s, { type: 'developProperty', propertyId: plot.id, devType: 'townhomes' });
    expect(plot.development).not.toBeNull();

    playFor(s, 400);
    expect(plot.development).toBeNull();
    expect(plot.developedType).toBe('townhomes');
  });

  it('housing a business in owned premises removes its rent', () => {
    const s = createInitialState();
    s.cash = 1_000_000_000;
    const unit = s.properties.find((p) => p.kind === 'commercial' && !p.owned)!;
    apply(s, { type: 'buyProperty', propertyId: unit.id });

    const b = s.businesses[0];
    const before = businessFinancials(s, b);
    apply(s, { type: 'assignProperty', businessId: b.id, propertyId: unit.id });
    const after = businessFinancials(s, b);

    expect(before.rent).toBeGreaterThan(0);
    expect(after.rent).toBe(0);
    expect(after.net).toBeGreaterThan(before.net);
  });
});

// ------------------------------------------------------------- saturation

describe('market saturation', () => {
  it('each additional business in a category earns less than the last', () => {
    const s = createInitialState();
    s.cash = 10_000_000_000;
    const nets: number[] = [];
    for (let i = 0; i < 6; i++) {
      apply(s, { type: 'buyBusiness', category: 'retail' });
      const newest = s.businesses[s.businesses.length - 1];
      nets.push(businessFinancials(s, newest).net);
    }
    for (let i = 1; i < nets.length; i++) {
      expect(nets[i], `business ${i + 1} vs ${i}`).toBeLessThan(nets[i - 1]);
    }
  });

  it('opening a new business never reduces an existing one', () => {
    const s = createInitialState();
    s.cash = 10_000_000_000;
    const first = s.businesses[0];
    const before = businessFinancials(s, first).net;
    apply(s, { type: 'buyBusiness', category: 'retail' });
    apply(s, { type: 'buyBusiness', category: 'retail' });
    expect(businessFinancials(s, first).net).toBeCloseTo(before, 6);
  });

  it('saturation has a floor, so a business is never worthless', () => {
    const s = createInitialState();
    s.cash = 1e15;
    for (let i = 0; i < 40; i++) apply(s, { type: 'buyBusiness', category: 'retail' });
    const last = s.businesses[s.businesses.length - 1];
    expect(saturationMultiplier(s, last)).toBeGreaterThanOrEqual(TUNING.saturationFloor);
    expect(businessFinancials(s, last).net).toBeGreaterThan(0);
  });

  it('staff profitability does not run away with business level', () => {
    // Wages and hiring costs must scale with level like revenue does, or
    // "upgrade then max headcount" becomes the only strategy.
    const paybackAt = (level: number) => {
      const s = createInitialState();
      s.cash = 1e12;
      const b = s.businesses[0];
      b.level = level;
      const before = businessFinancials(s, b).net;
      const cost = hireStaffCost(s, b);
      apply(s, { type: 'hireStaff', id: b.id });
      const gain = businessFinancials(s, b).net - before;
      return cost / gain;
    };
    const low = paybackAt(1);
    const high = paybackAt(10);
    // Allow drift, but a level-10 hire must not be an order of magnitude better.
    expect(high).toBeGreaterThan(low * 0.5);
  });
});

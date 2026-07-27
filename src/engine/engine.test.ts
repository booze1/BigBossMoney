import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { createRuntime, step, simulateOffline } from './sim';
import { apply } from './actions';
import { applyRoll } from './rolls';
import { resolveEventChoice } from './events';
import { EVENT_CARDS, EVENT_BY_ID } from './content/events';
import { ROLL_TABLE } from './content/luck';
import { CATEGORIES } from './content/businesses';
import { CURABLE_TRAITS, TRAIT_BY_ID, traitsFor } from './content/traits';
import { generateOffers } from './premises';
import { migrate } from './save';
import { createBusiness } from './state';
import { hire } from './mutations';
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
  maxStaff,
  serviceYears,
  severanceFor,
  tenureWeight,
  totalSeverance,
  businessValue,
  rarityOdds,
  reinvestCostScale,
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

  it('every chained follow-up exists and is chain-only', () => {
    for (const card of EVENT_CARDS) {
      for (const choice of card.choices) {
        for (const outcome of [choice.good, choice.bad]) {
          if (!outcome.chain) continue;
          const target = EVENT_BY_ID[outcome.chain.cardId];
          expect(target, `${card.id} chains to missing ${outcome.chain.cardId}`).toBeDefined();
          // A second act must never be drawable before its first.
          expect(target.chainOnly, `${outcome.chain.cardId} must be chainOnly`).toBe(true);
          expect(outcome.chain.delay).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every chain-only card is reachable from some chain', () => {
    const reachable = new Set<string>();
    for (const card of EVENT_CARDS) {
      for (const choice of card.choices) {
        for (const outcome of [choice.good, choice.bad]) {
          if (outcome.chain) reachable.add(outcome.chain.cardId);
        }
      }
    }
    for (const card of EVENT_CARDS) {
      if (card.chainOnly) expect(reachable.has(card.id), `${card.id} is unreachable`).toBe(true);
    }
  });

  it('every tag a card requires is written by some outcome', () => {
    const written = new Set<string>();
    for (const card of EVENT_CARDS) {
      for (const choice of card.choices) {
        for (const outcome of [choice.good, choice.bad]) {
          if (outcome.addTag) written.add(outcome.addTag.tag);
        }
      }
    }
    for (const card of EVENT_CARDS) {
      if (card.requiresTag) {
        expect(written.has(card.requiresTag), `${card.id} requires unwritable tag ${card.requiresTag}`).toBe(true);
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
    for (let i = 0; i < 4; i++) hire(s.businesses[0]);
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

// ------------------------------------------------------- player-reported

describe('reported issues', () => {
  it('no single event card can take more than the player has', () => {
    // Reported as "you randomly get set to zero". A bad outcome could exceed
    // the whole balance (measured at 205%), which zeroed cash and opened an
    // emergency credit line out of nowhere.
    for (const card of EVENT_CARDS) {
      for (let i = 0; i < card.choices.length; i++) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const s = createInitialState();
          s.businesses[0].level = 12;
          s.cash = 5_000;
          resolveEventChoice(s, s.businesses[0].id, card.id, i);
          expect(s.cash, `${card.id}[${i}] drove cash below zero`).toBeGreaterThanOrEqual(0);
          expect(s.debt.some((l) => l.id === 'auto'), `${card.id}[${i}] forced an emergency loan`).toBe(false);
        }
      }
    }
  });

  it('the emergency credit line never confiscates all spare cash', () => {
    const s = createInitialState();
    s.cash = 0;
    s.debt.push({ id: 'auto', principal: 50_000, rate: 0.0001, takenAt: Date.now() });
    s.cash = 10_000;
    const rt = createRuntime();
    step(s, 0.5, rt);
    // Some of it services the debt; the player keeps the rest and can act.
    expect(s.cash).toBeGreaterThan(0);
    expect(s.cash).toBeLessThan(10_000);
  });

  it('reinvestment gets dearer as the empire grows, but never free or infinite', () => {
    const small = createInitialState();
    const large = createInitialState();
    large.cash = 500_000_000;

    const a = reinvestCostScale(small);
    const b = reinvestCostScale(large);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(TUNING.costRampMax);
    // The opening must stay affordable — this is the whole reason the brake
    // ramps instead of being a flat multiplier.
    expect(a).toBeLessThan(1.6);
  });
});

describe('premises and traits', () => {
  it('every trait a card names actually exists', () => {
    for (const card of EVENT_CARDS) {
      for (const id of [card.requiresTrait, card.excludesTrait]) {
        if (id) expect(TRAIT_BY_ID[id], `${card.id} gates on trait ${id}`).toBeTruthy();
      }
      for (const choice of card.choices) {
        for (const outcome of [choice.good, choice.bad]) {
          for (const id of [outcome.addTrait, outcome.removeTrait]) {
            if (id) expect(TRAIT_BY_ID[id], `${card.id} writes trait ${id}`).toBeTruthy();
          }
        }
      }
    }
  });

  it('every curable flaw has a card that can actually clear it', () => {
    // Without this, a discounted premises is not a trade-off but a trap: the
    // player takes the cheap site and can never do anything about what is
    // wrong with it except sell.
    for (const traitId of CURABLE_TRAITS) {
      const cure = EVENT_CARDS.some((c) =>
        c.choices.some((ch) => [ch.good, ch.bad].some((o) => o.removeTrait === traitId)),
      );
      expect(cure, `nothing can cure "${traitId}"`).toBe(true);
    }
  });

  it('a cure card is only drawable on a business that has the flaw', () => {
    for (const card of EVENT_CARDS) {
      const cures = card.choices.flatMap((ch) =>
        [ch.good, ch.bad].map((o) => o.removeTrait).filter(Boolean),
      );
      for (const cured of cures) {
        expect(card.requiresTrait, `${card.id} cures ${cured} without requiring it`).toBe(cured);
      }
    }
  });

  it('offers three distinctly-named premises for every category', () => {
    for (const def of CATEGORIES) {
      const offers = generateOffers(def.id, []);
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map((o) => o.name)).size).toBe(3);
      for (const offer of offers) {
        expect(offer.priceMultiplier).toBeGreaterThan(0.4);
        expect(offer.priceMultiplier).toBeLessThan(2.2);
        for (const t of offer.traits) expect(TRAIT_BY_ID[t]).toBeTruthy();
      }
    }
  });

  it('never offers a premises under a name already trading', () => {
    const taken = CATEGORIES.flatMap((def) => def.names);
    for (const def of CATEGORIES) {
      for (const offer of generateOffers(def.id, taken)) {
        expect(taken).not.toContain(offer.name);
      }
    }
  });

  it('charges the asking price and hands over the traits', () => {
    const s = createInitialState();
    s.cash = 5_000_000;
    apply(s, { type: 'viewPremises', category: 'retail' });
    const offer = s.premises.retail![2];
    const expected = businessCost(s, CATEGORIES[0]) * offer.priceMultiplier;
    const before = s.cash;

    apply(s, { type: 'buyBusiness', category: 'retail', offerId: offer.id });

    const bought = s.businesses[s.businesses.length - 1];
    expect(bought.name).toBe(offer.name);
    expect(bought.traits).toEqual(offer.traits);
    expect(before - s.cash).toBeCloseTo(expected, 4);
  });

  it('regenerates the shortlist only after a purchase', () => {
    const s = createInitialState();
    s.cash = 5_000_000;
    apply(s, { type: 'viewPremises', category: 'retail' });
    const first = s.premises.retail!.map((o) => o.id);

    // Looking again must not reroll — otherwise the choice is free to dodge.
    apply(s, { type: 'viewPremises', category: 'retail' });
    expect(s.premises.retail!.map((o) => o.id)).toEqual(first);

    apply(s, { type: 'buyBusiness', category: 'retail', offerId: first[0] });
    apply(s, { type: 'viewPremises', category: 'retail' });
    expect(s.premises.retail!.map((o) => o.id)).not.toEqual(first);
  });

  it('traits move the money in the direction they claim to', () => {
    const s = createInitialState();
    const plain = s.businesses[0];
    const base = businessFinancials(s, plain).net;

    plain.traits = ['corner_lot']; // +8% revenue
    expect(businessFinancials(s, plain).net).toBeGreaterThan(base);

    plain.traits = ['backstreet']; // -10% revenue
    expect(businessFinancials(s, plain).net).toBeLessThan(base);

    plain.traits = ['damp']; // upkeep only
    expect(businessFinancials(s, plain).net).toBeLessThan(base);

    plain.traits = ['good_bones']; // cheaper to run
    expect(businessFinancials(s, plain).net).toBeGreaterThan(base);
  });

  it('no single trait makes a fresh business unprofitable while renting', () => {
    // The renting-is-viable invariant has to survive the worst premises the
    // shortlist can hand you, or the bargain option is never takeable.
    for (const def of CATEGORIES) {
      for (const trait of traitsFor(def.id)) {
        const s = createInitialState();
        const b = createBusiness(def.id, [], { name: 'Test', traits: [trait.id] });
        s.businesses = [b];
        expect(
          businessFinancials(s, b).net,
          `${def.id} with "${trait.id}" cannot pay its own rent`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('keeps hiring worthwhile on every premises', () => {
    // Wages scale off the same trait-adjusted reference as revenue, so a hire
    // must be a gain regardless of what the site is like.
    for (const def of CATEGORIES) {
      for (const trait of traitsFor(def.id)) {
        const s = createInitialState();
        const b = createBusiness(def.id, [], { name: 'Test', traits: [trait.id] });
        b.level = 5;
        s.businesses = [b];
        const before = businessFinancials(s, b).net;
        hire(b);
        expect(
          businessFinancials(s, b).net,
          `hiring at ${def.id} with "${trait.id}" loses money`,
        ).toBeGreaterThan(before);
      }
    }
  });

  it('cures a flaw permanently and survives a save round-trip', () => {
    const s = createInitialState();
    const b = s.businesses[0];
    b.traits = ['damp'];
    const damped = businessFinancials(s, b).net;

    // Take the expensive line, which cannot fail.
    s.cash = 1_000_000;
    resolveEventChoice(s, b.id, 'prem_damp_survey', 0);
    expect(b.traits).not.toContain('damp');
    expect(businessFinancials(s, b).net).toBeGreaterThan(damped);

    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    expect(restored.businesses[0].traits).toEqual([]);
  });

  it('backfills traits on a save written before they existed', () => {
    const s = createInitialState();
    const legacy = JSON.parse(JSON.stringify(s));
    for (const b of legacy.businesses) delete b.traits;
    delete legacy.premises;

    const loaded = migrate(legacy);
    for (const b of loaded.businesses) expect(Array.isArray(b.traits)).toBe(true);
    expect(loaded.premises).toEqual({});
    // And the financials still resolve rather than throwing on undefined.
    expect(Number.isFinite(businessFinancials(loaded, loaded.businesses[0]).net)).toBe(true);
  });
});

describe('premises presentation', () => {
  it('never sells two sites on the same shortlist with the same line', () => {
    for (let i = 0; i < 200; i++) {
      const offers = generateOffers('retail', []);
      expect(new Set(offers.map((o) => o.pitch)).size).toBe(offers.length);
    }
  });
});

describe('staff as people', () => {
  it('hires a named person into a role, not a counter', () => {
    const s = createInitialState();
    s.cash = 1_000_000;
    const b = s.businesses[0];
    apply(s, { type: 'hireStaff', id: b.id });

    expect(b.roster).toHaveLength(1);
    expect(b.roster[0].name).toMatch(/\S+ \S+/);
    expect(b.roster[0].role.length).toBeGreaterThan(0);
    expect(b.roster[0].hiredAt).toBeGreaterThan(0);
  });

  it('never puts two people with the same name on one team', () => {
    const s = createInitialState();
    s.cash = 1e12;
    const b = s.businesses[0];
    b.level = 20;
    for (let i = 0; i < maxStaff(b); i++) apply(s, { type: 'hireStaff', id: b.id });
    expect(b.roster.length).toBeGreaterThan(10);
    expect(new Set(b.roster.map((m) => m.name)).size).toBe(b.roster.length);
  });

  it('pays a lifer more than a new hire, but never without bound', () => {
    const s = createInitialState();
    const b = s.businesses[0];
    hire(b);
    const fresh = businessFinancials(s, b).net;

    // Twenty game years of service.
    b.roster[0].hiredAt = Date.now() - TUNING.secondsPerGameYear * 20 * 1000;
    const lifer = businessFinancials(s, b).net;
    expect(lifer).toBeGreaterThan(fresh);
    expect(tenureWeight(b.roster[0])).toBeCloseTo(1 + TUNING.tenureBonusMax, 6);

    // A century of service must be worth no more than the cap.
    b.roster[0].hiredAt = Date.now() - TUNING.secondsPerGameYear * 100 * 1000;
    expect(businessFinancials(s, b).net).toBeCloseTo(lifer, 6);
  });

  it('still keeps hiring worthwhile with the tenure bonus in play', () => {
    // The wage invariant has to hold at both ends of the tenure range.
    for (const def of CATEGORIES) {
      const s = createInitialState();
      const b = createBusiness(def.id, [], { name: 'Test', traits: [] });
      b.level = 5;
      s.businesses = [b];
      const empty = businessFinancials(s, b).net;
      hire(b);
      expect(businessFinancials(s, b).net, `${def.id}: a new hire loses money`).toBeGreaterThan(empty);
    }
  });

  it('charges severance that grows with service and dents morale', () => {
    const s = createInitialState();
    s.cash = 1_000_000;
    const b = s.businesses[0];
    hire(b);
    hire(b);
    const [veteran, rookie] = b.roster;
    veteran.hiredAt = Date.now() - TUNING.secondsPerGameYear * 10 * 1000;

    expect(severanceFor(s, b, veteran)).toBeGreaterThan(severanceFor(s, b, rookie));

    const cashBefore = s.cash;
    const moraleBefore = b.morale;
    const owed = severanceFor(s, b, veteran);
    apply(s, { type: 'fireStaff', id: b.id, memberId: veteran.id });

    expect(b.roster.map((m) => m.id)).toEqual([rookie.id]);
    // Severance is a function of Date.now(), and milliseconds pass between
    // quoting it and paying it. Assert the amount relatively: any real defect
    // here — the wrong person, the wrong formula — is off by orders of
    // magnitude, not by a millisecond of accrued service.
    expect(Math.abs(cashBefore - s.cash - owed) / owed).toBeLessThan(1e-4);
    expect(b.morale).toBeLessThan(moraleBefore);
  });

  it('lets go of the newest hire when no one is named', () => {
    const s = createInitialState();
    s.cash = 1_000_000;
    const b = s.businesses[0];
    hire(b);
    hire(b);
    const veteran = b.roster[0];
    apply(s, { type: 'fireStaff', id: b.id });
    expect(b.roster.map((m) => m.id)).toEqual([veteran.id]);
  });

  it('never lets severance take the player below zero', () => {
    const s = createInitialState();
    const b = s.businesses[0];
    b.level = 12;
    hire(b);
    b.roster[0].hiredAt = Date.now() - TUNING.secondsPerGameYear * 50 * 1000;
    s.cash = 1; // far less than is owed
    apply(s, { type: 'fireStaff', id: b.id });
    expect(s.cash).toBeGreaterThanOrEqual(0);
    expect(b.roster).toHaveLength(0);
  });

  it('pays everyone off when a business is sold, out of the proceeds', () => {
    const s = createInitialState();
    s.cash = 1e9;
    apply(s, { type: 'buyBusiness', category: 'retail' });
    const b = s.businesses[1];
    b.level = 8;
    for (let i = 0; i < 4; i++) hire(b);
    for (const m of b.roster) m.hiredAt = Date.now() - TUNING.secondsPerGameYear * 6 * 1000;

    const owed = totalSeverance(s, b);
    expect(owed).toBeGreaterThan(0);
    const expected = Math.max(0, businessValue(b) * 0.75 - owed);

    const before = s.cash;
    apply(s, { type: 'sellBusiness', id: b.id });
    expect(Math.abs(s.cash - before - expected) / expected).toBeLessThan(1e-4);
  });

  it('turns a legacy headcount into people who have been there all along', () => {
    const s = createInitialState();
    const legacy = JSON.parse(JSON.stringify(s));
    legacy.businesses[0].foundedAt = Date.now() - TUNING.secondsPerGameYear * 5 * 1000;
    delete legacy.businesses[0].roster;
    legacy.businesses[0].staff = 3;

    const loaded = migrate(legacy);
    const b = loaded.businesses[0];
    expect(b.roster).toHaveLength(3);
    expect(new Set(b.roster.map((m) => m.name)).size).toBe(3);
    for (const m of b.roster) expect(serviceYears(m)).toBeGreaterThan(4);
    expect((b as unknown as { staff?: number }).staff).toBeUndefined();
  });
});

describe('the while-you-were-out report', () => {
  it('attributes earnings to their source and they add up', () => {
    const s = createInitialState();
    s.cash = 5_000_000;
    apply(s, { type: 'buyProperty', propertyId: s.properties.find((p) => p.rentYield > 0)!.id });
    apply(s, { type: 'borrow', amount: 50_000 });
    const cashBefore = s.cash;

    const r = simulateOffline(s, 3600, 7200);

    expect(r.fromBusinesses).toBeGreaterThan(0);
    expect(r.fromProperty).toBeGreaterThan(0);
    // Interest compounds onto the principal rather than taking cash, so it is
    // reported separately and must not appear in the earnings identity.
    expect(r.interestAccrued).toBeGreaterThan(0);
    expect(r.fromBusinesses + r.fromProperty - r.debtRepaid).toBeCloseTo(s.cash - cashBefore, 2);
    expect(r.earned).toBeCloseTo(s.cash - cashBefore, 6);
  });

  it('draws a curve that starts where net worth was and ends where it is', () => {
    const s = createInitialState();
    const before = netWorth(s);
    const r = simulateOffline(s, 3600, 7200);

    expect(r.curve.length).toBeGreaterThan(3);
    expect(r.curve[0]).toBeCloseTo(before, 4);
    expect(r.curve[r.curve.length - 1]).toBeCloseTo(netWorth(s), 4);
    expect(r.netWorthBefore).toBeCloseTo(before, 4);
    expect(r.netWorthAfter).toBeCloseTo(netWorth(s), 4);
    for (const point of r.curve) expect(Number.isFinite(point)).toBe(true);
  });

  it('reports a development that finished while you were away', () => {
    const s = createInitialState();
    s.cash = 50_000_000;
    const land = s.properties.find((p) => p.kind === 'land')!;
    apply(s, { type: 'buyProperty', propertyId: land.id });
    apply(s, { type: 'developProperty', propertyId: land.id, devType: DEVELOPMENT_OPTIONS[0].type });
    expect(land.development).not.toBeNull();

    const r = simulateOffline(s, 12 * 3600, 24 * 3600);
    expect(land.development).toBeNull();
    expect(r.notes.some((n) => /finished at/.test(n.text))).toBe(true);
  });

  it('notices somebody passing a service milestone', () => {
    const s = createInitialState();
    const b = s.businesses[0];
    hire(b);
    // Just short of five years when you leave.
    // Five and a half years of service now, two of which happened while away,
    // so they were at 3.5 years when the player left and crossed five since.
    // Five is the smallest milestone that counts — a game year is two and a
    // half real minutes, so anything shorter fires on every absence.
    b.roster[0].hiredAt = Date.now() - TUNING.secondsPerGameYear * 5.5 * 1000;

    const r = simulateOffline(s, TUNING.secondsPerGameYear * 2, 24 * 3600);
    const milestone = r.notes.find((n) => /passed 5 years/.test(n.text));
    expect(milestone, JSON.stringify(r.notes)).toBeTruthy();
    expect(milestone!.text).toContain(b.roster[0].name);
  });

  it('stays quiet when nothing worth reporting happened', () => {
    const s = createInitialState();
    const r = simulateOffline(s, TUNING.offlineMinSeconds + 1, 24 * 3600);
    // A fresh empire over a minute: no debt, no builds, no milestones. Market
    // drift may or may not clear the threshold, so the bound is "not a wall".
    expect(r.notes.length).toBeLessThanOrEqual(3);
  });

  it('never returns a wall of notes, however much happened', () => {
    const s = createInitialState();
    s.cash = 1e9;
    // Everything at once: a big roster of near-milestone lifers, debt, and a
    // long enough absence for every market to have moved.
    const b = s.businesses[0];
    b.level = 20;
    for (let i = 0; i < 12; i++) {
      hire(b);
      b.roster[i].hiredAt = Date.now() - TUNING.secondsPerGameYear * 9.9 * 1000;
    }
    apply(s, { type: 'borrow', amount: 100_000 });
    for (const p of s.properties.slice(0, 5)) p.owned = true;

    const r = simulateOffline(s, 24 * 3600, 24 * 3600);
    expect(r.notes.length).toBeLessThanOrEqual(6);
    // And the long-service lines collapse rather than listing twelve people.
    expect(r.notes.filter((n) => n.icon === '🎖').length).toBeLessThanOrEqual(2);
    for (const n of r.notes) {
      expect(n.text.length).toBeGreaterThan(0);
      expect(['good', 'bad', 'neutral']).toContain(n.tone);
    }
  });

  it('survives a save round-trip with the report attached', () => {
    const s = createInitialState();
    s.offlineReport = simulateOffline(s, 3600, 7200);
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(restored.offlineReport!.curve).toEqual(s.offlineReport!.curve);
    expect(restored.offlineReport!.notes.length).toBe(s.offlineReport!.notes.length);
  });
});

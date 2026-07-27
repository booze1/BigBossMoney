import type { Business, CategoryId, City, GameState, Property, Rarity } from './types';
import { TUNING, TIERS, RARITY_META, RARITY_ORDER } from './content/tuning';
import { CATEGORIES, CATEGORY_BY_ID, MANAGER_BY_TIER, CategoryDef } from './content/businesses';
import { DEVELOPMENT_BY_TYPE } from './content/realestate';
import { LUXURY_BY_ID } from './content/luxury';
import {
  traitRevenueMultiplier,
  traitStaffCapDelta,
  traitUpkeepDelta,
} from './premises';

/**
 * Pure derived state. Nothing here mutates; the simulation and the UI both
 * read through these so a number shown on screen is always the number used.
 */

export const legacyLevel = (s: GameState, id: string): number => s.legacyUpgrades[id] ?? 0;

// ---------------------------------------------------------------- flex & luck

/**
 * Raw flex before the Old Money legacy multiplier: possessions plus any
 * permanent flex granted by luck rolls (stored as never-expiring boosts).
 */
export function baseFlex(s: GameState): number {
  const fromItems = s.luxury.reduce((sum, owned) => sum + (LUXURY_BY_ID[owned.itemId]?.flex ?? 0), 0);
  const fromRolls = s.boosts.filter((b) => b.kind === 'flex').reduce((sum, b) => sum + b.power, 0);
  return fromItems + fromRolls;
}

export function flexScore(s: GameState): number {
  const multiplier = 1 + legacyLevel(s, 'flex') * 0.15;
  return baseFlex(s) * multiplier;
}

/**
 * Total Luck: the base stat plus the contribution from Flex. Luck rewards are
 * applied straight to `s.luck` rather than as timed boosts, so there is no
 * third term here.
 */
export function totalLuck(s: GameState): number {
  return Math.max(0, s.luck + flexScore(s) * TUNING.flexLuckPerPoint);
}

/** Rarity weights after the Luck stat has skewed them. */
export function rarityWeights(luck: number): Record<Rarity, number> {
  const out = {} as Record<Rarity, number>;
  for (const r of RARITY_ORDER) {
    const meta = RARITY_META[r];
    const scaled = meta.weight * (1 + (luck / 100) * meta.luckScale);
    out[r] = Math.max(meta.weight * 0.08, scaled);
  }
  return out;
}

export function rarityOdds(luck: number): Record<Rarity, number> {
  const weights = rarityWeights(luck);
  const total = RARITY_ORDER.reduce((sum, r) => sum + weights[r], 0);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITY_ORDER) out[r] = weights[r] / total;
  return out;
}

// ------------------------------------------------------------------- income

/** Empire-wide multiplier: legacy, flex and any non-category income boosts. */
export function empireIncomeMultiplier(s: GameState): number {
  const legacy = 1 + legacyLevel(s, 'income') * 0.12;
  const flex = 1 + flexScore(s) / TUNING.flexIncomeDivisor;
  const boosts = s.boosts
    .filter((b) => b.kind === 'income' && b.category === null)
    .reduce((mult, b) => mult * b.power, 1);
  return legacy * flex * boosts;
}

/** Boosts scoped to one business's category. */
function categoryBoostMultiplier(s: GameState, business: Business): number {
  return s.boosts
    .filter((b) => b.kind === 'income' && b.category === business.category)
    .reduce((mult, b) => mult * b.power, 1);
}

/**
 * How much of full revenue a business earns, given how many others the player
 * already runs in that category. Ordering is by founding order, so an existing
 * business never loses output when a newer one opens beside it.
 */
export function saturationMultiplier(s: GameState, b: Business): number {
  // Ranked by position in the list, which is founding order. Using foundedAt
  // timestamps instead would tie for anything opened in the same millisecond
  // and hand both businesses full output.
  let rank = 0;
  for (const x of s.businesses) {
    if (x.id === b.id) break;
    if (x.category === b.category) rank++;
  }
  return Math.max(TUNING.saturationFloor, Math.pow(TUNING.saturationDecay, rank));
}

/** What the next business in this category would earn, as a fraction. */
export function nextSaturation(s: GameState, category: CategoryId): number {
  const owned = s.businesses.filter((x) => x.category === category).length;
  return Math.max(TUNING.saturationFloor, Math.pow(TUNING.saturationDecay, owned));
}

export interface BusinessFinancials {
  gross: number;
  upkeep: number;
  net: number;
  wages: number;
  rent: number;
  managerSalary: number;
  saturation: number;
  staffMultiplier: number;
  moraleMultiplier: number;
  boostMultiplier: number;
}

/** Full income breakdown for one business, per second. */
export function businessFinancials(s: GameState, b: Business): BusinessFinancials {
  const def = CATEGORY_BY_ID[b.category];
  const manager = MANAGER_BY_TIER[b.manager];

  const saturation = saturationMultiplier(s, b);
  const traitRevenue = traitRevenueMultiplier(b.traits);
  const levelRevenue =
    def.baseRevenue * Math.pow(TUNING.revenuePerLevel, b.level - 1) * saturation * traitRevenue;
  const staffMultiplier = 1 + b.staff * TUNING.staffRevenueBonus;
  const boostMultiplier = categoryBoostMultiplier(s, b) * empireIncomeMultiplier(s);

  const gross =
    levelRevenue * staffMultiplier * b.morale * manager.revenueBonus * boostMultiplier;

  // Upkeep is proportional to the pre-boost revenue so boosts lift net income,
  // not just gross. Owning your premises removes rent and widens the margin.
  const baseline = levelRevenue * staffMultiplier;
  const ownsPremises = b.propertyId !== null;
  // Traits move the upkeep ratio rather than the upkeep amount, so a damp
  // building costs proportionally more to run at every level rather than being
  // a fixed early-game tax that stops mattering.
  const upkeepRatio = Math.max(
    0.02,
    def.upkeepRatio - (ownsPremises ? TUNING.ownedPropertyMarginBonus : 0) + traitUpkeepDelta(b.traits),
  );

  const fixed = baseline * upkeepRatio;
  const rent = ownsPremises ? 0 : baseline * TUNING.rentRatio;
  // Wages and salary scale with the saturated, level-adjusted revenue.
  // Wages previously ignored the level term while staff *output* included it,
  // which made each hire ~12x more profitable at level 10 than at level 1 and
  // turned "upgrade, then max headcount" into the only strategy worth playing.
  // Wages and salary scale off the same reference as revenue, traits included.
  // If they did not, a premises with a revenue trait would change how
  // profitable a hire is, and the invariant that keeps hiring worthwhile
  // (staffWageRatio below the margin a hire adds) would hold on some sites and
  // fail on others.
  const levelFactor = Math.pow(TUNING.revenuePerLevel, b.level - 1);
  const scaleRef = def.baseRevenue * saturation * levelFactor * traitRevenue;
  const wages = scaleRef * TUNING.staffWageRatio * b.staff;
  const managerSalary = scaleRef * manager.salaryRatio;

  const upkeep = fixed + rent + wages + managerSalary;

  return {
    gross,
    upkeep,
    net: gross - upkeep,
    wages,
    rent,
    managerSalary,
    saturation,
    staffMultiplier,
    moraleMultiplier: b.morale,
    boostMultiplier,
  };
}

export function businessIncome(s: GameState): number {
  return s.businesses.reduce((sum, b) => sum + businessFinancials(s, b).net, 0);
}

export function rentIncome(s: GameState): number {
  return s.properties
    .filter((p) => p.owned)
    .reduce((sum, p) => sum + propertyRentPerSecond(s, p), 0);
}

export function interestPerSecond(s: GameState): number {
  return s.debt.reduce((sum, l) => sum + l.principal * l.rate, 0);
}

/** Net cash flow per second across the whole empire. */
export function totalIncome(s: GameState): number {
  return businessIncome(s) + rentIncome(s) - interestPerSecond(s);
}

// -------------------------------------------------------------- real estate

export function cityById(s: GameState, id: string): City | undefined {
  return s.cities.find((c) => c.id === id);
}

export function propertyValue(s: GameState, p: Property): number {
  const city = cityById(s, p.cityId);
  const index = city?.index ?? 1;
  const dev = p.developedType ? DEVELOPMENT_BY_TYPE[p.developedType] : null;
  return p.baseValue * index * (dev?.valueMultiplier ?? 1);
}

export function propertyYield(p: Property): number {
  const dev = p.developedType ? DEVELOPMENT_BY_TYPE[p.developedType] : null;
  return p.rentYield + (dev?.yieldBonus ?? 0);
}

export function propertyRentPerSecond(s: GameState, p: Property): number {
  if (!p.owned || p.development) return 0;
  // A commercial unit housing one of your businesses pays you no rent — the
  // benefit shows up as that business's margin instead.
  if (isPropertyOccupied(s, p.id)) return 0;
  return (propertyValue(s, p) * propertyYield(p)) / TUNING.secondsPerGameYear;
}

export function isPropertyOccupied(s: GameState, propertyId: string): boolean {
  return s.businesses.some((b) => b.propertyId === propertyId);
}

export function occupyingBusiness(s: GameState, propertyId: string): Business | undefined {
  return s.businesses.find((b) => b.propertyId === propertyId);
}

// ------------------------------------------------------------------ markets

export function portfolioValue(s: GameState): number {
  return s.holdings.reduce((sum, h) => {
    const a = s.assets.find((x) => x.id === h.assetId);
    return sum + (a ? h.units * a.price : 0);
  }, 0);
}

export function portfolioCost(s: GameState): number {
  return s.holdings.reduce((sum, h) => sum + h.units * h.costBasis, 0);
}

/** Multiplier applied to realised trading profits by `market` boosts. */
export function marketBoostMultiplier(s: GameState): number {
  return s.boosts
    .filter((b) => b.kind === 'market')
    .reduce((mult, b) => mult * b.power, 1);
}

// -------------------------------------------------------------- net worth

export function businessValue(b: Business): number {
  const def = CATEGORY_BY_ID[b.category];
  return def.baseCost * Math.pow(TUNING.revenuePerLevel, b.level - 1);
}

export function luxuryValue(s: GameState): number {
  return s.luxury.reduce((sum, l) => sum + l.value, 0);
}

export function realEstateValue(s: GameState): number {
  return s.properties
    .filter((p) => p.owned)
    .reduce((sum, p) => sum + propertyValue(s, p), 0);
}

export function totalDebt(s: GameState): number {
  return s.debt.reduce((sum, l) => sum + l.principal, 0);
}

export function netWorth(s: GameState): number {
  return (
    s.cash +
    s.businesses.reduce((sum, b) => sum + businessValue(b), 0) +
    portfolioValue(s) +
    realEstateValue(s) +
    luxuryValue(s) -
    totalDebt(s)
  );
}

// ------------------------------------------------------------------- tiers

export type TierDef = (typeof TIERS)[number];

export function currentTier(s: GameState): TierDef {
  const nw = netWorth(s);
  let tier: TierDef = TIERS[0];
  for (const t of TIERS) if (nw >= t.at) tier = t;
  return tier;
}

export function nextTier(s: GameState) {
  const nw = netWorth(s);
  return TIERS.find((t) => nw < t.at) ?? null;
}

export function tierProgress(s: GameState): number {
  const nw = netWorth(s);
  const cur = currentTier(s);
  const next = nextTier(s);
  if (!next) return 1;
  const span = next.at - cur.at;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (nw - cur.at) / span));
}

// ------------------------------------------------------------------- costs

/**
 * Price of any reinvestment: the global pacing scale, less the Buying Power
 * legacy discount.
 */
export function costMultiplier(s: GameState): number {
  const discount = Math.max(0.4, 1 - legacyLevel(s, 'cost') * 0.04);
  return reinvestCostScale(s) * discount;
}

/**
 * How much dearer reinvestment has become as the empire has grown. Starts at
 * ~1 so the opening is untouched, and climbs steadily — this is what stops the
 * late game compounding away in a couple of minutes.
 */
export function reinvestCostScale(s: GameState): number {
  const nw = Math.max(0, netWorth(s));
  const ramp = 1 + Math.pow(nw / TUNING.costRampReference, TUNING.costRampExponent);
  // Capped: uncapped this reaches ~230x by the IPO threshold, which stops
  // expansion outright rather than merely slowing it.
  return Math.min(TUNING.costRampMax, ramp);
}

/** How much dearer this tier is to buy into than the first one. */
export function tierCostRamp(def: CategoryDef): number {
  const tier = CATEGORIES.findIndex((c) => c.id === def.id);
  return Math.pow(TUNING.tierCostRamp, Math.max(0, tier));
}

export function businessCost(s: GameState, def: CategoryDef): number {
  const owned = s.businesses.filter((b) => b.category === def.id).length;
  return (
    def.baseCost * tierCostRamp(def) * Math.pow(TUNING.costGrowthPerOwned, owned) * costMultiplier(s)
  );
}

export function upgradeCost(s: GameState, b: Business): number {
  const def = CATEGORY_BY_ID[b.category];
  return (
    def.baseCost *
    tierCostRamp(def) *
    TUNING.upgradeCostFactor *
    Math.pow(TUNING.upgradeCostGrowth, b.level - 1) *
    costMultiplier(s)
  );
}

export function maxStaff(b: Business): number {
  return Math.max(1, b.level * TUNING.staffPerLevel + traitStaffCapDelta(b.traits));
}

export function hireStaffCost(s: GameState, b: Business): number {
  const def = CATEGORY_BY_ID[b.category];
  const levelFactor = Math.pow(TUNING.revenuePerLevel, b.level - 1);
  return def.baseRevenue * levelFactor * 8 * Math.pow(1.18, b.staff) * costMultiplier(s);
}

export function managerHireCost(s: GameState, b: Business, tier: keyof typeof MANAGER_BY_TIER): number {
  const def = MANAGER_BY_TIER[tier];
  return businessValue(b) * def.hireCostRatio * costMultiplier(s);
}

/**
 * Manual hustle payout. The net-worth term is capped: uncapped it grows without
 * bound and rewards autoclicking over actually running the empire.
 */
export function hustlePayout(s: GameState): number {
  const bonus = Math.min(TUNING.hustleMaxBonus, Math.max(0, netWorth(s)) * TUNING.hustleNetWorthFactor);
  return TUNING.hustleBase + bonus;
}

export function rollCost(s: GameState): number {
  return TUNING.rollBaseCost + Math.max(0, netWorth(s)) * TUNING.rollNetWorthFactor;
}

export function freeRollInterval(s: GameState): number {
  const reduction = 1 - legacyLevel(s, 'rollspeed') * 0.06;
  return TUNING.freeRollSeconds * Math.max(0.3, reduction);
}

// -------------------------------------------------------------------- debt

export function loanRate(s: GameState): number {
  const discount = flexScore(s) / TUNING.flexLoanDiscountDivisor;
  const annual = Math.max(0.03, TUNING.loanBaseAnnualRate - discount * 0.06);
  return annual / TUNING.secondsPerGameYear;
}

export function borrowingCapacity(s: GameState): number {
  const assets = netWorth(s) + totalDebt(s);
  return Math.max(0, assets * TUNING.loanLimitRatio - totalDebt(s));
}

// ---------------------------------------------------------------- offline

export function offlineCapSeconds(s: GameState): number {
  const bonusHours = legacyLevel(s, 'offline') * 2 + (s.legacyUpgrades['_offlineBonus'] ?? 0);
  return (TUNING.offlineBaseCapHours + bonusHours) * 3600;
}

// --------------------------------------------------------------- prestige

/** Legacy Points a voluntary IPO would pay out right now. */
export function projectedLegacyPoints(s: GameState): number {
  const peak = Math.max(s.stats.peakNetWorth, netWorth(s));
  if (peak < TUNING.ipoMinNetWorth) return 0;
  return Math.floor(TUNING.legacyPointsFactor * Math.sqrt(peak / TUNING.legacyPointsReference));
}

export function canIPO(s: GameState): boolean {
  return netWorth(s) >= TUNING.ipoMinNetWorth;
}

// ------------------------------------------------------------------ unlock

export function isCategoryUnlocked(s: GameState, def: CategoryDef): boolean {
  return netWorth(s) >= def.unlockAt || s.businesses.some((b) => b.category === def.id);
}

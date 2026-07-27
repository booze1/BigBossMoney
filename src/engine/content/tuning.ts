/**
 * Every balance number in one file.
 *
 * Target pacing: a fresh player reaches the Big Boss tier ($50M) and their
 * first IPO in roughly two to three hours of mixed active/idle play.
 */

export const TUNING = {
  /** Starting bankroll. The player also gets one free retail store. */
  startingCash: 1_500,

  /** Simulation step. The loop accumulates real time and steps at this rate. */
  tickSeconds: 0.2,
  /** Never simulate more than this in one frame, to survive tab-throttling. */
  maxCatchUpSeconds: 5,

  /** Offline earnings. */
  offlineBaseCapHours: 2,
  offlineRate: 0.55,
  /** Minimum gap before an offline report is worth showing. */
  offlineMinSeconds: 60,

  /** Manual "Hustle" button for the opening minutes. */
  hustleBase: 45,
  hustleNetWorthFactor: 0.0004,
  hustleCooldown: 0.35,

  /** Business economics. */
  /**
   * Global multiplier on every category's base revenue. This is the master
   * pacing dial: it sets how many seconds a business takes to pay for itself,
   * and therefore how fast the whole empire compounds. Lower is slower.
   */
  baseIncomeScale: 1.0,
  costGrowthPerOwned: 1.3,
  upgradeCostFactor: 0.6,
  upgradeCostGrowth: 1.35,
  revenuePerLevel: 1.28,
  staffPerLevel: 2,
  staffRevenueBonus: 0.06,
  /** Wage per staff member per second, as a fraction of base revenue. */
  staffWageRatio: 0.04,
  /** Rent paid when a business has no owned commercial property behind it. */
  rentRatio: 0.12,
  /** Margin bonus for operating out of property you own. */
  ownedPropertyMarginBonus: 0.08,

  /** Morale drifts back to neutral at this rate per second. */
  moraleDecay: 0.012,
  moraleMin: 0.55,
  moraleMax: 1.75,

  /** Event cards. */
  eventCooldownMin: 55,
  eventCooldownMax: 110,
  eventExpirySeconds: 150,
  maxPendingEvents: 6,
  /**
   * Scales every `cashSeconds` outcome. Cards are authored on a 0-600 scale
   * for readability; at this factor a business's card stream contributes
   * roughly a third of its passive income, so decisions matter without
   * eclipsing the businesses themselves.
   */
  cashSecondsScale: 0.2,

  /** Luck's pull on a card's good-outcome odds, capped. */
  luckOddsPerPoint: 0.0011,
  maxLuckOddsBonus: 0.22,

  /** Luck rolls. */
  freeRollSeconds: 180,
  rollBaseCost: 2_500,
  /** Roll cost scales with net worth so it stays relevant late. */
  rollNetWorthFactor: 0.004,
  maxRollTokens: 25,

  /** Markets. */
  marketNewsIntervalMin: 28,
  marketNewsIntervalMax: 70,
  /** News shocks decay with this half-life in seconds. */
  shockHalfLife: 45,
  priceHistoryLength: 90,
  /** How often a history point is recorded, in seconds. */
  historyIntervalSeconds: 2,
  tradingFee: 0.004,

  /** Real estate. */
  cityIndexVol: 0.0016,
  /** Rent yields are quoted annually; this converts to per-second. */
  secondsPerGameYear: 1_800,
  listingRefreshSeconds: 300,
  listingsPerCity: 5,
  propertySaleFee: 0.05,

  /** Luxury goods revalue on this cadence. */
  luxuryRevalueSeconds: 30,

  /** Flex. */
  flexLuckPerPoint: 0.05,
  flexIncomeDivisor: 2_400,
  flexLoanDiscountDivisor: 9_000,

  /** Debt. */
  loanBaseAnnualRate: 0.14,
  /** Max borrow as a multiple of net worth. */
  loanLimitRatio: 0.45,
  /** Net worth below this (negative) forces the bankruptcy prompt. */
  bankruptcyThreshold: -25_000,

  /** Prestige. */
  ipoMinNetWorth: 250_000_000,
  legacyPointsFactor: 12,
  legacyPointsReference: 250_000_000,
  /** Bankruptcy pays out a fraction of a voluntary IPO's legacy points. */
  bankruptcyLegacyRatio: 0.35,

  /** Log/news ring buffers. */
  maxLog: 60,
  maxNews: 30,
} as const;

export const TIERS = [
  { id: 'hustler', name: 'Hustler', at: 0, blurb: 'Everyone starts somewhere.' },
  { id: 'entrepreneur', name: 'Entrepreneur', at: 50_000, blurb: 'You have employees now. Act like it.' },
  { id: 'tycoon', name: 'Tycoon', at: 500_000, blurb: 'People take your calls.' },
  { id: 'mogul', name: 'Mogul', at: 5_000_000, blurb: 'You are on a magazine cover.' },
  { id: 'bigboss', name: 'Big Boss', at: 50_000_000, blurb: 'The room quiets when you walk in.' },
  { id: 'billionaire', name: 'Billionaire', at: 1_000_000_000, blurb: 'Ten figures. Nothing left to prove.' },
] as const;

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;

export const RARITY_META = {
  common: { name: 'Common', color: '#8A94A6', weight: 60, luckScale: -0.55 },
  uncommon: { name: 'Uncommon', color: '#3DDC91', weight: 25, luckScale: 0 },
  rare: { name: 'Rare', color: '#38A3F5', weight: 10, luckScale: 0.6 },
  epic: { name: 'Epic', color: '#A16BF5', weight: 3.6, luckScale: 1.2 },
  legendary: { name: 'Legendary', color: '#F5A623', weight: 1.2, luckScale: 2.0 },
  mythic: { name: 'Mythic', color: '#FF4D6D', weight: 0.2, luckScale: 3.0 },
} as const;

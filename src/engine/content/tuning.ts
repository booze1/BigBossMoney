/**
 * Every balance number in one file.
 *
 * Target pacing: a fresh player reaches the Big Boss tier ($50M) and their
 * first IPO in roughly two to three hours of mixed active/idle play.
 */

export const TUNING = {
  /** Starting bankroll. The player also gets one free retail store. */
  startingCash: 1_500,

  /** Never simulate more than this in one frame, to survive tab-throttling. */
  maxCatchUpSeconds: 5,

  /** Offline earnings. */
  offlineBaseCapHours: 2,
  offlineRate: 0.55,
  /** Minimum gap before an offline report is worth showing. */
  offlineMinSeconds: 60,

  /**
   * Manual "Hustle" button for the opening minutes. The net-worth term is
   * capped: without a ceiling it scales forever and an autoclicker out-earns
   * the entire empire.
   */
  hustleBase: 45,
  hustleNetWorthFactor: 0.0004,
  hustleMaxBonus: 500,
  hustleCooldown: 1.5,

  /** Business economics. */
  /**
   * Master pacing brake. Reinvestment prices are multiplied by
   * `1 + (netWorth / costRampReference) ^ costRampExponent`.
   *
   * A flat multiplier controls run length reliably but ruins the opening — at
   * the scale needed to slow the endgame the second shop costs half an hour of
   * income. Ramping with net worth instead leaves the first minutes untouched
   * and bites hardest exactly where growth used to run away.
   *
   * Applied to purchases, upgrades, hires and managers — never to a business's
   * balance-sheet value, or the higher price would inflate net worth and
   * cancel itself out.
   */
  costRampReference: 50_000,
  costRampExponent: 0.6,
  /** Ceiling on the ramp, so late-game expansion stays expensive but possible. */
  costRampMax: 30,
  /**
   * Market saturation. The n-th business in a category earns
   * `saturationDecay^n` of full revenue, floored at `saturationFloor`.
   *
   * Without this, duplicates cost 1.3^n but earn a flat amount, and because
   * late-game cash is effectively unlimited the answer to "what next" is
   * always "another one of those" — an optimal player ended runs holding 90+
   * businesses. Saturation gives each category a natural ceiling and pushes
   * late capital into property and markets instead.
   */
  saturationDecay: 0.9,
  saturationFloor: 0.12,
  /**
   * Global multiplier on every category's base revenue. This is the master
   * pacing dial: it sets how many seconds a business takes to pay for itself,
   * and therefore how fast the whole empire compounds. Lower is slower.
   */
  baseIncomeScale: 1.0,
  costGrowthPerOwned: 1.3,
  /**
   * Capital ramp across the category ladder. The n-th tier costs
   * `tierCostRamp^n` more to buy and upgrade, while earning the same — so a
   * corner store pays for itself in ~200s and a development arm takes far
   * longer.
   *
   * Without this every tier had an identical payback period, so the empire
   * compounded at a constant rate from the first shop to the last tower and
   * the late game arrived in a couple of minutes. This flattens the curve
   * where it was steepest and leaves the opening untouched.
   *
   * Applied to purchase and upgrade prices only, never to a business's
   * balance-sheet value — otherwise the higher cost would inflate net worth
   * and undo itself.
   */
  tierCostRamp: 1.25,
  upgradeCostFactor: 0.6,
  upgradeCostGrowth: 1.5,
  revenuePerLevel: 1.24,
  staffPerLevel: 2,
  staffRevenueBonus: 0.06,
  /**
   * Wage per staff member per second, as a fraction of that business's
   * level-adjusted revenue.
   *
   * Must stay below `staffRevenueBonus * (1 - upkeepRatio - rentRatio)` — the
   * margin a hire actually adds — or hiring is a guaranteed loss and the whole
   * staffing system is dead weight. At 0.06 bonus and ~0.335 margin that
   * ceiling is ~0.020.
   */
  staffWageRatio: 0.008,

  /**
   * Loyalty. Each year of service adds `tenureBonusPerYear` to what one person
   * contributes, capped at `tenureBonusMax` — so a lifer is worth a quarter
   * more than a new hire and no more than that. The cap is what keeps the wage
   * invariant above intact: without it a long run would drift staff output
   * arbitrarily far from the wages paying for it.
   */
  tenureBonusPerYear: 0.03,
  tenureBonusMax: 0.25,

  /**
   * Severance, in seconds of that person's wage, growing with service. This is
   * the cost of churn: firing a lifer to trim a wage bill is expensive, and
   * closing a business pays out everyone at once. Capped so a very old empire
   * cannot make its own staff unfireable.
   */
  severanceBaseSeconds: 240,
  severancePerYearSeconds: 90,
  severanceMaxSeconds: 1_500,

  /**
   * Incorporating a business you designed yourself.
   *
   * Drafting and arguing with a design are free — nobody should pay for
   * something they have not seen — but filing one costs, and each one after it
   * costs more. That escalation is the structure: a catalogue is meant to be a
   * few companies you believed in, not a scrapbook of everything you typed.
   *
   * The base is one standard retail store, so the first design reads as "about
   * the price of a shop", and the whole thing rides the same net-worth cost
   * ramp as every other purchase.
   */
  designBaseFee: 5_000,
  designFeeGrowth: 0.8,
  /**
   * Net worth before the option appears at all. Low enough to reach in a few
   * minutes, high enough that a new player meets the six real categories before
   * being handed a blank page.
   */
  designUnlockAt: 25_000,
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
   * How much of a business's drawable deck to hold back as "recently seen".
   * At 0.75 a business gets through three quarters of everything available to
   * it before anything can repeat.
   */
  deckMemoryRatio: 0.85,
  /** Minimum unowned listings kept available per unlocked city. */
  minListingsPerCity: 4,
  /**
   * Scales every `cashSeconds` outcome. Cards are authored on a 0-600 scale
   * for readability; at this factor a business's card stream contributes
   * roughly a third of its passive income, so decisions matter without
   * eclipsing the businesses themselves.
   */
  cashSecondsScale: 0.2,

  /**
   * The most of your cash a single event card may take. Uncapped, a bad
   * outcome could exceed the whole balance (measured at 205%), which zeroed
   * the player's cash and opened an emergency credit line out of nowhere —
   * it read as the game randomly resetting you. A card should hurt, not wipe.
   */
  maxEventLossRatio: 0.6,

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
  /**
   * Length of a financial year in real seconds. Governs rent, loan interest
   * and luxury revaluation alike.
   *
   * At 1,800 a property took ~6,000s to pay for itself against ~900s for a
   * business, so rental income was never worth buying and debt never bit. A
   * shorter year puts property within reach of the saturated late game and
   * makes leverage genuinely dangerous.
   */
  secondsPerGameYear: 150,
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
  /**
   * Share of spare cash the emergency credit line claims each tick. It used to
   * take everything, which pinned the balance at zero until the line cleared.
   */
  autoRepayRatio: 0.4,
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

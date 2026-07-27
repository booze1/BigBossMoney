/**
 * Core type definitions for Big Boss Money.
 *
 * The whole game is one serialisable `GameState` object. Everything the
 * simulation needs lives here, so a save is just `JSON.stringify(state)`.
 */

export type CategoryId =
  | 'retail'
  | 'restaurant'
  | 'nightclub'
  | 'tech'
  | 'bank'
  | 'devco';

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export type TierId =
  | 'hustler'
  | 'entrepreneur'
  | 'tycoon'
  | 'mogul'
  | 'bigboss'
  | 'billionaire';

export type ManagerTier = 'none' | 'junior' | 'senior' | 'exec' | 'legend';

/** A single owned business instance. */
export interface Business {
  id: string;
  category: CategoryId;
  name: string;
  level: number;
  staff: number;
  manager: ManagerTier;
  /** Property id backing this business, or null if renting. */
  propertyId: string | null;
  /** Multiplier from recent event-card outcomes; decays toward 1. */
  morale: number;
  /** Seconds until this business surfaces its next event card. */
  eventCooldown: number;
  /** Lifetime gross revenue, for stats screens. */
  lifetimeRevenue: number;
  foundedAt: number;
}

/** A tradeable market instrument (equity or crypto). */
export interface Asset {
  id: string;
  name: string;
  ticker: string;
  kind: 'stock' | 'crypto';
  price: number;
  /** Per-tick drift and volatility, mutated by news events. */
  drift: number;
  vol: number;
  /** Temporary drift shock from a news event; decays each tick. */
  shock: number;
  history: number[];
  sector: string;
}

export interface Holding {
  assetId: string;
  units: number;
  /** Volume-weighted average cost basis per unit. */
  costBasis: number;
}

export type PropertyKind = 'residential' | 'commercial' | 'land';

export interface Property {
  id: string;
  cityId: string;
  name: string;
  kind: PropertyKind;
  /** What it cost the player. 0 if not owned. */
  purchasePrice: number;
  /** Intrinsic value before the city index is applied. */
  baseValue: number;
  /** Annualised rent as a fraction of value; 0 for raw land. */
  rentYield: number;
  owned: boolean;
  /** Development in progress, if any. */
  development: Development | null;
  /** Set once a development completes; boosts value and yield. */
  developedType: string | null;
}

export interface Development {
  type: string;
  label: string;
  /** Seconds of build time remaining. */
  remaining: number;
  totalTime: number;
  valueMultiplier: number;
  yieldBonus: number;
}

export interface City {
  id: string;
  name: string;
  country: string;
  /** Market index; property values scale with it. Drifts over time. */
  index: number;
  indexDrift: number;
  history: number[];
  /** Net worth needed before this city unlocks. */
  unlockAt: number;
}

export interface LuxuryItem {
  id: string;
  name: string;
  brand: string;
  category: 'car' | 'watch' | 'jet' | 'yacht' | 'estate';
  price: number;
  flex: number;
  /** Per-year value change as a fraction; negative = depreciates. */
  appreciation: number;
  /** Net worth gate. */
  unlockAt: number;
}

export interface OwnedLuxury {
  itemId: string;
  /** Current market value, drifts from purchase price over time. */
  value: number;
  purchasedAt: number;
}

/** An active timed buff from a luck roll or event. */
export interface Boost {
  id: string;
  label: string;
  rarity: Rarity;
  kind: 'income' | 'luck' | 'market' | 'flex' | 'offline';
  /** Multiplier for `income`/`market`, flat additive for `luck`/`flex`. */
  power: number;
  /** Seconds remaining; Infinity for permanent boosts. */
  remaining: number;
  duration: number;
  /** Restricted to one category, or null for empire-wide. */
  category: CategoryId | null;
}

export interface EventChoice {
  label: string;
  /** Short outcome hint shown under the button. */
  hint: string;
  /** Chance the good outcome fires (0..1). Luck stat nudges this up. */
  odds: number;
  good: EventOutcome;
  bad: EventOutcome;
}

export interface EventOutcome {
  text: string;
  /** Flat cash delta. */
  cash?: number;
  /** Cash delta as a multiple of the business's per-second net. */
  cashSeconds?: number;
  /** Additive change to business morale multiplier. */
  morale?: number;
  /** Grants a timed boost. */
  boost?: { label: string; kind: Boost['kind']; power: number; duration: number; scope: 'business' | 'empire' };
  /** Additive staff change. */
  staff?: number;
  /** Additive luck change (permanent). */
  luck?: number;
  /** Grants roll tokens. */
  rolls?: number;
}

export interface EventCardDef {
  id: string;
  category: CategoryId | 'any';
  title: string;
  body: string;
  /** Minimum business level before this card can appear. */
  minLevel?: number;
  choices: EventChoice[];
}

/** A card queued up and awaiting the player's decision. */
export interface PendingEvent {
  uid: string;
  defId: string;
  businessId: string | null;
  createdAt: number;
  /** Seconds before the card expires on its own. */
  expiresIn: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  detail: string;
  at: number;
  tone: 'good' | 'bad' | 'neutral';
}

export interface LogEntry {
  id: string;
  at: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'epic';
}

export interface Loan {
  id: string;
  principal: number;
  /** Per-second interest rate. */
  rate: number;
  takenAt: number;
}

export interface Stats {
  peakNetWorth: number;
  totalEarned: number;
  eventsResolved: number;
  rollsMade: number;
  mythicsPulled: number;
  businessesFounded: number;
  bankruptcies: number;
  ipos: number;
  playTime: number;
}

export interface Settings {
  reducedMotion: boolean;
  compactNumbers: boolean;
  autoResolveManaged: boolean;
}

export interface GameState {
  version: number;
  /** Wall-clock ms of the last simulated tick. Drives offline earnings. */
  lastTick: number;
  startedAt: number;

  cash: number;
  debt: Loan[];

  businesses: Business[];
  assets: Asset[];
  holdings: Holding[];
  cities: City[];
  properties: Property[];
  luxury: OwnedLuxury[];

  boosts: Boost[];
  /** Base luck before boosts. Raised by flex, legacy and events. */
  luck: number;
  rollTokens: number;
  /** Seconds until the next free roll token is granted. */
  rollTimer: number;

  pendingEvents: PendingEvent[];
  news: NewsItem[];
  log: LogEntry[];

  /** Permanent prestige currency and the multipliers it has bought. */
  legacyPoints: number;
  legacyUpgrades: Record<string, number>;

  stats: Stats;
  settings: Settings;

  /** Transient UI signals the renderer consumes then clears. */
  flash: { id: string; text: string; rarity?: Rarity; tone: LogEntry['tone'] } | null;
  /** Set when the player has crossed into bankruptcy territory. */
  bankruptcyWarning: boolean;
  /** Populated on load when offline earnings were collected. */
  offlineReport: { seconds: number; earned: number; capped: boolean } | null;
  seenIntro: boolean;
}

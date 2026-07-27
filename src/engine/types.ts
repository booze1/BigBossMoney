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

export type BoostKind = 'income' | 'market' | 'flex';

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export type ManagerTier = 'none' | 'junior' | 'senior' | 'exec' | 'legend';

/** Somebody on the payroll. */
export interface StaffMember {
  id: string;
  name: string;
  /** What they do — flavour, but it is what makes the roster read as people. */
  role: string;
  /** Wall-clock ms. Tenure is derived from this against the game-year length. */
  hiredAt: number;
}

/** A single owned business instance. */
export interface Business {
  id: string;
  category: CategoryId;
  name: string;
  level: number;
  /**
   * The people who work here, longest-serving first. Replaced a plain count:
   * tenure pays, severance costs, and closing a business has to be able to say
   * who it puts out of work.
   */
  roster: StaffMember[];
  manager: ManagerTier;
  /** Property id backing this business, or null if renting. */
  propertyId: string | null;
  /**
   * Trait ids from the premises this was bought as. These are what make two
   * businesses of the same category and level different from each other, and
   * some of them can be cleared or acquired later through events.
   */
  traits: string[];
  /** Multiplier from recent event-card outcomes; decays toward 1. */
  morale: number;
  /** Seconds until this business surfaces its next event card. */
  eventCooldown: number;
  /** Lifetime gross revenue, for stats screens. */
  lifetimeRevenue: number;
  foundedAt: number;
  /**
   * Situational memory written by card outcomes and read by later cards, as
   * tag -> seconds remaining. This is what lets a business that was wrecked
   * last week read differently from one that has never had a problem.
   */
  tags: Record<string, number>;
  /**
   * Card ids drawn recently at this business, newest last. The draw excludes
   * these, making the deck a shuffled bag rather than an independent roll —
   * with independent draws a repeat arrives after roughly sqrt(pi*n/2) cards
   * no matter how large the deck is.
   */
  recentCards: string[];
}

/** One premises on the shortlist for a category you have not bought yet. */
export interface PremisesOffer {
  id: string;
  category: CategoryId;
  /** The name the business would trade under. */
  name: string;
  traits: string[];
  /** Asking price as a multiple of the category's standard cost. */
  priceMultiplier: number;
  /** A line of estate-agent copy, unrelated to anything true. */
  pitch: string;
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
  kind: BoostKind;
  /** Multiplier for `income`/`market`, flat additive for `flex`. */
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
  /** Writes a memory tag onto the business for `seconds` (default 600). */
  addTag?: { tag: string; seconds?: number };
  /** Clears a memory tag. */
  removeTag?: string;
  /** Permanently gives the premises a trait. */
  addTrait?: string;
  /** Permanently clears a trait — how a bad site gets fixed rather than sold. */
  removeTrait?: string;
  /** Queues a specific follow-up card, giving a decision a second act. */
  chain?: { cardId: string; delay: number };
  /** Flat cash delta. */
  cash?: number;
  /** Cash delta as a multiple of the business's per-second net. */
  cashSeconds?: number;
  /** Additive change to business morale multiplier. */
  morale?: number;
  /** Grants a timed boost. */
  boost?: { label: string; kind: BoostKind; power: number; duration: number; scope: 'business' | 'empire' };
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
  /** Only drawable when the business carries this memory tag. */
  requiresTag?: string;
  /** Never drawn while the business carries this tag. */
  excludesTag?: string;
  /** Only drawable when the premises carries this trait. */
  requiresTrait?: string;
  /** Never drawn while the premises carries this trait. */
  excludesTrait?: string;
  /**
   * Follow-up cards are queued explicitly by a chain and never drawn at
   * random, so a second act cannot arrive before its first.
   */
  chainOnly?: boolean;
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

/** A follow-up card queued by an earlier decision. */
export interface ScheduledEvent {
  defId: string;
  businessId: string | null;
  fireIn: number;
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
  /**
   * The premises shortlist per category, held in the save so backing out of a
   * purchase cannot reroll it. Cleared for a category when you buy there.
   */
  premises: Partial<Record<CategoryId, PremisesOffer[]>>;
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
  /** Seconds until the manual hustle action can be used again. */
  hustleCooldown: number;

  pendingEvents: PendingEvent[];
  /** Chained follow-ups waiting to fire, as seconds remaining. */
  scheduledEvents: ScheduledEvent[];
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

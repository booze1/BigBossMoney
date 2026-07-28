import type { Business, CustomDesign, GameState, Stats } from './types';
import { TUNING } from './content/tuning';
import { CATEGORY_BY_ID } from './content/businesses';
import { createAssets } from './content/markets';
import { createCities, generateCityListings } from './content/realestate';
import { range, uid, pick } from './rng';

export const SAVE_VERSION = 1;

function emptyStats(): Stats {
  return {
    peakNetWorth: 0,
    totalEarned: 0,
    eventsResolved: 0,
    rollsMade: 0,
    mythicsPulled: 0,
    businessesFounded: 0,
    bankruptcies: 0,
    ipos: 0,
    playTime: 0,
  };
}

export function createBusiness(
  category: Business['category'],
  existingNames: string[],
  /** Set when opening from a premises shortlist, which names and shapes it. */
  from?: { name: string; traits: string[]; designId?: string },
): Business {
  const def = CATEGORY_BY_ID[category];
  const unused = def.names.filter((n) => !existingNames.includes(n));
  const fallback = unused.length > 0 ? pick(unused) : `${pick(def.names)} ${existingNames.length + 1}`;
  const name = from?.name ?? fallback;

  return {
    id: uid('biz'),
    category,
    name,
    traits: from?.traits ?? [],
    designId: from?.designId ?? null,
    level: 1,
    roster: [],
    manager: 'none',
    propertyId: null,
    morale: 1,
    // Stagger first cards so a new empire does not fire everything at once.
    eventCooldown: range(20, 45),
    lifetimeRevenue: 0,
    foundedAt: Date.now(),
    tags: {},
    recentCards: [],
  };
}

export interface CarryOver {
  legacyPoints: number;
  legacyUpgrades: Record<string, number>;
  stats: Stats;
  /**
   * The design catalogue. Survives a reset because the empire is what prestige
   * takes; the ideas are what you keep, and their history across runs is what
   * makes reopening one mean something.
   */
  designs: CustomDesign[];
}

/**
 * Builds a fresh run. `carry` is supplied after an IPO or a bankruptcy so
 * permanent progression survives the reset.
 */
export function createInitialState(carry?: CarryOver): GameState {
  const legacyUpgrades = carry?.legacyUpgrades ?? {};
  const seedLevel = legacyUpgrades['seed'] ?? 0;
  const luckLevel = legacyUpgrades['luck'] ?? 0;

  const startingCash = TUNING.startingCash * Math.pow(4, seedLevel);

  const cities = createCities();
  const properties = cities.flatMap((c) => generateCityListings(c.id, TUNING.listingsPerCity));

  const firstBusiness = createBusiness('retail', []);
  firstBusiness.name = 'Corner Store';

  const now = Date.now();

  return {
    version: SAVE_VERSION,
    lastTick: now,
    startedAt: now,

    cash: startingCash,
    debt: [],

    businesses: [firstBusiness],
    // Copied rather than shared: prestige replaces the state object wholesale
    // and the old array must not stay reachable through the new one.
    designs: (carry?.designs ?? []).map((d) => ({ ...d })),
    premises: {},
    assets: createAssets(),
    holdings: [],
    cities,
    properties,
    luxury: [],

    boosts: [],
    luck: luckLevel * 20,
    rollTokens: 3,
    rollTimer: TUNING.freeRollSeconds,
    hustleCooldown: 0,

    pendingEvents: [],
    scheduledEvents: [],
    news: [],
    press: { queue: [], signature: '', lastFetchAt: 0 },
    log: [
      {
        id: uid('log'),
        at: now,
        text: carry
          ? 'New venture, same instincts. Your reputation carries over.'
          : 'You have a corner store, a small pile of cash, and no excuses.',
        tone: 'neutral',
      },
    ],

    legacyPoints: carry?.legacyPoints ?? 0,
    legacyUpgrades: { ...legacyUpgrades },

    stats: carry?.stats ?? emptyStats(),
    settings: {
      reducedMotion: false,
      autoResolveManaged: true,
    },

    flash: null,
    bankruptcyWarning: false,
    offlineReport: null,
    seenIntro: carry !== undefined,
  };
}

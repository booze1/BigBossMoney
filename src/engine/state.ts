import type { Business, GameState, Stats } from './types';
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

export function createBusiness(category: Business['category'], existingNames: string[]): Business {
  const def = CATEGORY_BY_ID[category];
  const unused = def.names.filter((n) => !existingNames.includes(n));
  const name = unused.length > 0 ? pick(unused) : `${pick(def.names)} ${existingNames.length + 1}`;

  return {
    id: uid('biz'),
    category,
    name,
    level: 1,
    staff: 0,
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

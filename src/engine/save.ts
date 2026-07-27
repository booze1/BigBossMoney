import type { GameState } from './types';
import { SAVE_VERSION, createInitialState } from './state';
import { simulateOffline } from './sim';
import { offlineCapSeconds } from './selectors';
import { TUNING } from './content/tuning';

const KEY = 'bigbossmoney.save.v1';

export function save(state: GameState): void {
  try {
    state.lastTick = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be full or blocked (private browsing). The game keeps
    // running in memory; there is nothing useful to tell the player here.
  }
}
export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Loads a save and applies offline earnings, or creates a fresh game.
 */
export function load(): GameState {
  let parsed: Partial<GameState> | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) parsed = JSON.parse(raw) as Partial<GameState>;
  } catch {
    parsed = null;
  }
  return migrate(parsed);
}

/**
 * Brings a parsed save up to the current shape, then applies offline earnings.
 *
 * Missing fields are backfilled from a fresh state so a save written by an
 * older build never crashes the app — every field added since v1 has to be
 * defaulted here, and the engine test drives this function directly rather
 * than going through storage.
 */
export function migrate(parsed: Partial<GameState> | null): GameState {
  if (!parsed || typeof parsed !== 'object') return createInitialState();

  const fresh = createInitialState();
  const state: GameState = {
    ...fresh,
    ...parsed,
    version: SAVE_VERSION,
    // Nested collections are taken from the save when present, otherwise the
    // fresh defaults, so a partially-written save still loads.
    businesses: parsed.businesses?.length ? parsed.businesses : fresh.businesses,
    premises: parsed.premises ?? {},
    assets: parsed.assets?.length ? parsed.assets : fresh.assets,
    cities: parsed.cities?.length ? parsed.cities : fresh.cities,
    properties: parsed.properties ?? fresh.properties,
    holdings: parsed.holdings ?? [],
    luxury: parsed.luxury ?? [],
    boosts: parsed.boosts ?? [],
    debt: parsed.debt ?? [],
    pendingEvents: parsed.pendingEvents ?? [],
    scheduledEvents: parsed.scheduledEvents ?? [],
    news: parsed.news ?? [],
    log: parsed.log ?? [],
    legacyUpgrades: parsed.legacyUpgrades ?? {},
    stats: { ...fresh.stats, ...(parsed.stats ?? {}) },
    settings: { ...fresh.settings, ...(parsed.settings ?? {}) },
    flash: null,
    offlineReport: null,
  };

  // Businesses from before memory tags and premises traits existed need the
  // fields backfilled. An untraited business is valid — it just means every
  // selector reads it as a plain site — so no trait is invented here.
  for (const b of state.businesses) {
    if (!b.tags) b.tags = {};
    if (!b.recentCards) b.recentCards = [];
    if (!Array.isArray(b.traits)) b.traits = [];
  }

  // Boost durations serialise Infinity as null; restore permanent boosts.
  for (const b of state.boosts) {
    if (b.remaining === null || !Number.isFinite(b.remaining)) b.remaining = Infinity;
    if (b.duration === null || !Number.isFinite(b.duration)) b.duration = Infinity;
  }

  const elapsed = Math.max(0, (Date.now() - (parsed.lastTick ?? Date.now())) / 1000);
  if (elapsed >= TUNING.offlineMinSeconds) {
    const result = simulateOffline(state, elapsed, offlineCapSeconds(state));
    state.offlineReport = result;
  }
  state.lastTick = Date.now();

  return state;
}

/** Export the save as a string the player can copy somewhere safe. */
export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(encoded: string): GameState | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded.trim())));
    const parsed = JSON.parse(json) as GameState;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.businesses)) return null;
    localStorage.setItem(KEY, JSON.stringify(parsed));
    return load();
  } catch {
    return null;
  }
}

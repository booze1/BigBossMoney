import type { GameState, PressItem } from '../engine/types';
import { CATEGORY_BY_ID } from '../engine/content/businesses';
import { LUXURY_BY_ID } from '../engine/content/luxury';
import { currentTier, netWorth, totalDebt } from '../engine/selectors';
import { money } from '../engine/format';
import { callGemini } from './client';

/**
 * A press that writes about your empire.
 *
 * The static templates say "{name} misses guidance". This says "Corner Store
 * magnate moves into nightclubs weeks after a third health inspection", because
 * it is given a picture of what you actually own and what has actually been
 * happening to it.
 *
 * Three constraints shape the whole design:
 *
 * - It costs money, so it is batched. One call returns a dozen stories that
 *   print over the following quarter of an hour, rather than one call per
 *   headline.
 * - It must work offline, so the batch lives in the save and keeps printing
 *   with no signal. Running dry falls back to the authored templates, which is
 *   also exactly what happens with no key at all.
 * - The engine owns every number. An item names a tone and at most one ticker;
 *   the market move comes from PRESS_EFFECTS, derived from the authored
 *   templates. A generated headline cannot hit harder than a written one.
 */

/** Fetch when the queue drops to this. */
export const PRESS_LOW_WATER = 3;
/** Never call more often than this, whatever the queue looks like. */
export const PRESS_MIN_INTERVAL_MS = 6 * 60 * 1000;
const BATCH = 12;

// ------------------------------------------------------------------ snapshot

export interface EmpireSnapshot {
  netWorth: string;
  tier: string;
  businesses: string[];
  staff: number;
  debt: string;
  luxury: string[];
  cities: string[];
  recent: string[];
  runs: number;
}

/**
 * What the press knows about you. Kept deliberately small — it is sent on every
 * call and the player is paying for the tokens — and deliberately concrete,
 * because "a large empire" produces generic copy while "Nonna's Table, level 8"
 * produces something worth reading.
 */
export function buildSnapshot(s: GameState): EmpireSnapshot {
  const byValue = [...s.businesses].sort((a, b) => b.level - a.level).slice(0, 5);

  return {
    netWorth: money(netWorth(s)),
    tier: currentTier(s).name,
    businesses: byValue.map(
      (b) => `${b.name} (${CATEGORY_BY_ID[b.category].name}, level ${b.level}, ${b.roster.length} staff)`,
    ),
    staff: s.businesses.reduce((sum, b) => sum + b.roster.length, 0),
    debt: totalDebt(s) > 0 ? money(totalDebt(s)) : 'none',
    luxury: s.luxury.slice(0, 3).map((l) => LUXURY_BY_ID[l.itemId]?.name ?? 'something expensive'),
    cities: [
      ...new Set(
        s.properties.filter((p) => p.owned).map((p) => s.cities.find((c) => c.id === p.cityId)?.name ?? ''),
      ),
    ].filter(Boolean),
    // The log is where the empire's actual history lives — the cards played,
    // the people let go, the things that went wrong.
    recent: s.log.slice(0, 6).map((l) => l.text.slice(0, 140)),
    runs: s.stats.ipos + s.stats.bankruptcies,
  };
}

/**
 * A coarse fingerprint. The press is stale when the empire has changed shape,
 * not when a number has ticked — comparing net worth directly would refetch
 * constantly, since it changes every second.
 */
export function pressSignature(s: GameState): string {
  const magnitude = Math.floor(Math.log10(Math.max(1, netWorth(s))));
  const categories = new Set(s.businesses.map((b) => b.category)).size;
  return [magnitude, s.businesses.length, categories, s.stats.ipos, s.stats.bankruptcies].join('|');
}

// -------------------------------------------------------------------- prompt

function systemPrompt(tickers: { id: string; ticker: string; name: string; kind: string }[]): string {
  return `You write the business press in Big Boss Money, a game about building a business empire. Your job is to make the player feel watched.

Return JSON only, matching the schema.

Write ${BATCH} short news items about the empire described to you. Rules:

- Reference the empire specifically. Name its businesses. Refer to what has just happened to it. A generic headline is a wasted one.
- Dry, deadpan, faintly unimpressed. This is the financial press, not a fan. It is happy to imply the player is a menace.
- headline: under 90 characters, in newspaper style, no full stop.
- detail: one or two sentences. It may be sceptical of the player.
- tone: good, bad or neutral, from the point of view of the player's fortunes.
- assetId: optionally one of the tickers below, when the story is genuinely about that company or coin. Otherwise null, which means a story about the wider market or about the player. Most items should be null.
- Vary them. Some about a business, some about the player personally, some about the market, some about the staff, some about the city they operate in.

Do not invent tickers. Do not mention game mechanics, levels, or numbers of "seconds". Never mention that any of this is a game.

Tickers you may reference:
${tickers.map((t) => `  ${t.id} — ${t.ticker}, ${t.name} (${t.kind})`).join('\n')}`;
}

function responseSchema(assetIds: string[]) {
  return {
    type: 'object',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['headline', 'detail', 'tone'],
          properties: {
            headline: { type: 'string' },
            detail: { type: 'string' },
            tone: { type: 'string', enum: ['good', 'bad', 'neutral'] },
            assetId: { type: 'string', enum: [...assetIds, 'none'] },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------- validation

const HEADLINE_MAX = 110;
const DETAIL_MAX = 240;

/**
 * Untrusted, like everything else that arrives from the model. An item with a
 * ticker the game does not have is dropped rather than reassigned — a headline
 * about a company moving the wrong company's price is worse than one story
 * fewer.
 */
export function validatePress(raw: unknown, assetIds: Set<string>): PressItem[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];

  const out: PressItem[] = [];
  for (const entry of items.slice(0, BATCH * 2)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;

    const headline = typeof e.headline === 'string' ? e.headline.trim().replace(/\s+/g, ' ') : '';
    const detail = typeof e.detail === 'string' ? e.detail.trim().replace(/\s+/g, ' ') : '';
    if (!headline || !detail) continue;

    const tone = e.tone === 'good' || e.tone === 'bad' ? e.tone : 'neutral';

    let assetId: string | null = null;
    if (typeof e.assetId === 'string' && e.assetId !== 'none') {
      if (!assetIds.has(e.assetId)) continue;
      assetId = e.assetId;
    }

    out.push({
      id: `press_${out.length}_${Date.now().toString(36)}`,
      headline: headline.slice(0, HEADLINE_MAX),
      detail: detail.slice(0, DETAIL_MAX),
      tone,
      assetId,
    });
  }
  return out;
}

// -------------------------------------------------------------------- public

/** Writes a fresh batch of press about this empire. Throws AiError on failure. */
export async function generatePress(s: GameState, signal?: AbortSignal): Promise<PressItem[]> {
  const tickers = s.assets.map((a) => ({ id: a.id, ticker: a.ticker, name: a.name, kind: a.kind }));
  const snapshot = buildSnapshot(s);

  const raw = await callGemini(
    {
      system: systemPrompt(tickers),
      schema: responseSchema(tickers.map((t) => t.id)),
    },
    `The empire as it stands:\n\n${JSON.stringify(snapshot, null, 1)}`,
    signal,
  );

  return validatePress(raw, new Set(tickers.map((t) => t.id)));
}

/**
 * Whether it is worth spending a call right now. Deliberately conservative:
 * the player is paying for these, and a queue that still has stories in it is
 * not an emergency.
 */
export function shouldRefreshPress(s: GameState, now = Date.now()): boolean {
  if (now - s.press.lastFetchAt < PRESS_MIN_INTERVAL_MS) return false;
  if (s.press.queue.length > PRESS_LOW_WATER) return false;
  return true;
}

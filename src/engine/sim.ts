import type {
  Business,
  EventCardDef,
  GameState,
  OfflineNote,
  OfflineResult,
  PressItem,
  PropertyKind,
} from './types';
import { TUNING } from './content/tuning';
import { MANAGER_BY_TIER } from './content/businesses';
import { EVENTS_BY_CATEGORY } from './content/events';
import { NEWS_TEMPLATES, PRESS_EFFECTS } from './content/markets';
import { DEVELOPMENT_BY_TYPE, PROPERTY_HEADLINES, generateListing } from './content/realestate';
import { LUXURY_BY_ID } from './content/luxury';
import {
  businessFinancials,
  freeRollInterval,
  netWorth,
  propertyRentPerSecond,
  serviceYears,
  totalDebt,
} from './selectors';
import { traitEventRate } from './premises';
import { cardById, designCards } from './custom';
import { addCash, addLog, addNews, coverShortfall, grantRolls } from './mutations';
import { chance, gaussian, pick, range, uid } from './rng';
import { money } from './format';
import { resolveEventChoice } from './events';

/**
 * Runtime-only accumulators. These are intentionally not part of GameState:
 * they are sub-second timers that would be noise in a save file, and losing
 * them across a reload costs the player nothing.
 */
interface SimRuntime {
  newsTimer: number;
  historyTimer: number;
  luxuryTimer: number;
  listingTimer: number;
}

export function createRuntime(): SimRuntime {
  return {
    newsTimer: range(10, 25),
    historyTimer: 0,
    luxuryTimer: TUNING.luxuryRevalueSeconds,
    listingTimer: TUNING.listingRefreshSeconds,
  };
}

/**
 * Advances the whole simulation by `dt` seconds, mutating `s` in place.
 * Called several times a second while the tab is visible, and once with a
 * large `dt` when returning from offline (via `simulateOffline`).
 */
export function step(s: GameState, dt: number, rt: SimRuntime): void {
  s.stats.playTime += dt;

  stepBusinesses(s, dt);
  stepProperties(s, dt);
  stepDebt(s, dt);
  stepBoosts(s, dt);
  stepRolls(s, dt);
  stepMarkets(s, dt, rt);
  stepCities(s, dt, rt);
  stepLuxury(s, dt, rt);
  stepEvents(s, dt);
  stepListings(s, dt, rt);

  coverShortfall(s);

  const nw = netWorth(s);
  if (nw > s.stats.peakNetWorth) s.stats.peakNetWorth = nw;
  s.bankruptcyWarning = nw < TUNING.bankruptcyThreshold;
}

// ------------------------------------------------------------------ income

function stepBusinesses(s: GameState, dt: number): void {
  for (const b of s.businesses) {
    const fin = businessFinancials(s, b);
    addCash(s, fin.net * dt);
    b.lifetimeRevenue += Math.max(0, fin.gross * dt);

    // Morale always drifts back toward neutral, so event outcomes are
    // impactful but never permanent.
    if (b.morale > 1) b.morale = Math.max(1, b.morale - TUNING.moraleDecay * dt);
    else if (b.morale < 1) b.morale = Math.min(1, b.morale + TUNING.moraleDecay * dt);
  }
}

function stepProperties(s: GameState, dt: number): void {
  for (const p of s.properties) {
    if (!p.owned) continue;

    if (p.development) {
      p.development.remaining -= dt;
      if (p.development.remaining <= 0) {
        const dev = p.development;
        p.developedType = dev.type;
        p.rentYield = 0;
        p.development = null;
        addLog(s, `${dev.label} completed at ${p.name}. Value and rent jump sharply.`, 'good');
      }
      continue;
    }

    addCash(s, propertyRentPerSecond(s, p) * dt);
  }
}

function stepDebt(s: GameState, dt: number): void {
  for (const loan of s.debt) {
    loan.principal += loan.principal * loan.rate * dt;
  }
  // Spare cash services the emergency line, but only a share of it. Taking
  // everything left the balance sitting at zero for as long as the line was
  // open, which is indistinguishable from the game confiscating your money.
  const auto = s.debt.find((l) => l.id === 'auto');
  if (auto && s.cash > 0) {
    const payment = Math.min(auto.principal, s.cash * TUNING.autoRepayRatio);
    auto.principal -= payment;
    s.cash -= payment;
  }
  s.debt = s.debt.filter((l) => l.principal > 1);
}

function stepBoosts(s: GameState, dt: number): void {
  for (const b of s.boosts) {
    if (Number.isFinite(b.remaining)) b.remaining -= dt;
  }
  const expired = s.boosts.filter((b) => b.remaining <= 0);
  for (const b of expired) {
    if (b.duration >= 240) addLog(s, `${b.label} has expired.`, 'neutral');
  }
  s.boosts = s.boosts.filter((b) => b.remaining > 0);
}

function stepRolls(s: GameState, dt: number): void {
  if (s.hustleCooldown > 0) s.hustleCooldown = Math.max(0, s.hustleCooldown - dt);
  if (s.rollTokens >= TUNING.maxRollTokens) return;
  s.rollTimer -= dt;
  while (s.rollTimer <= 0) {
    grantRolls(s, 1);
    s.rollTimer += freeRollInterval(s);
    if (s.rollTokens >= TUNING.maxRollTokens) break;
  }
}

// ----------------------------------------------------------------- markets

function stepMarkets(s: GameState, dt: number, rt: SimRuntime): void {
  const decay = Math.pow(0.5, dt / TUNING.shockHalfLife);

  for (const a of s.assets) {
    a.shock *= decay;
    const mu = a.drift + a.shock;
    // Geometric random walk. sqrt(dt) keeps volatility consistent regardless
    // of how the frame time is chopped up.
    const change = mu * dt + a.vol * Math.sqrt(dt) * gaussian();
    a.price = Math.max(0.0001, a.price * (1 + change));

    // A stablecoin that is only mostly stable.
    if (a.id === 'stableish') a.price += (1 - a.price) * 0.05 * dt;

    // RugCoin does exactly what its name promises, occasionally.
    if (a.id === 'rugcoin' && chance(0.00018 * dt)) {
      a.price *= 0.12;
      addNews(s, 'RugCoin team wallets emptied overnight', 'RUGZ down 88%. The website is a blank page. Nobody is surprised.', 'bad');
      addLog(s, 'RUGZ rug-pulled. Anyone holding it just found out why it was cheap.', 'bad');
    }
  }

  rt.historyTimer -= dt;
  if (rt.historyTimer <= 0) {
    rt.historyTimer = TUNING.historyIntervalSeconds;
    for (const a of s.assets) {
      a.history.push(a.price);
      if (a.history.length > TUNING.priceHistoryLength) a.history.shift();
    }
  }

  rt.newsTimer -= dt;
  if (rt.newsTimer <= 0) {
    rt.newsTimer = range(TUNING.marketNewsIntervalMin, TUNING.marketNewsIntervalMax);
    fireMarketNews(s);
  }
}

/** Exported for the test suite, which drives one news beat at a time. */
export function fireMarketNews(s: GameState): void {
  // Press written about this empire takes precedence over the stock templates.
  // It is consumed one item per news beat and never regenerated here — the
  // engine has no network and must not acquire one, so refilling the queue is
  // the store's job and this simply falls back when it runs dry.
  const item = s.press.queue.shift();
  if (item) {
    printPress(s, item);
    return;
  }

  const template = pick(NEWS_TEMPLATES);

  if (!template.kind) {
    // Macro news moves the whole board.
    for (const a of s.assets) {
      const scale = a.kind === 'crypto' ? 2.2 : 1;
      a.price = Math.max(0.0001, a.price * (1 + template.jump * scale * range(0.6, 1.4)));
      a.shock += template.shock * scale;
    }
    addNews(s, template.headline, template.detail, template.tone);
    return;
  }

  const candidates = s.assets.filter((a) => a.kind === template.kind);
  if (candidates.length === 0) return;
  const asset = pick(candidates);

  asset.price = Math.max(0.0001, asset.price * (1 + template.jump * range(0.75, 1.3)));
  asset.shock += template.shock;

  const headline = template.headline.replace('{name}', asset.name).replace('{ticker}', asset.ticker);
  const detail = template.detail.replace('{name}', asset.name).replace('{ticker}', asset.ticker);
  addNews(s, headline, detail, template.tone);
}

/**
 * Prints one piece of empire press and applies the market move its tone and
 * target imply. The item itself carries no numbers.
 */
function printPress(s: GameState, item: PressItem): void {
  const asset = item.assetId ? s.assets.find((a) => a.id === item.assetId) : undefined;
  const kind = asset ? asset.kind : 'macro';
  const effect = PRESS_EFFECTS[kind][item.tone];

  if (asset) {
    asset.price = Math.max(0.0001, asset.price * (1 + effect.jump * range(0.75, 1.3)));
    asset.shock += effect.shock;
  } else if (effect.jump !== 0) {
    for (const a of s.assets) {
      const scale = a.kind === 'crypto' ? 2.2 : 1;
      a.price = Math.max(0.0001, a.price * (1 + effect.jump * scale * range(0.6, 1.4)));
      a.shock += effect.shock * scale;
    }
  }

  addNews(s, item.headline, item.detail, item.tone);
}

function stepCities(s: GameState, dt: number, rt: SimRuntime): void {
  for (const c of s.cities) {
    const change = c.indexDrift * dt + TUNING.cityIndexVol * Math.sqrt(dt) * gaussian();
    c.index = Math.max(0.25, c.index * (1 + change));

    if (chance(0.00012 * dt * 60)) {
      const item = pick(PROPERTY_HEADLINES);
      const swing = item.tone === 'good' ? range(0.03, 0.09) : -range(0.03, 0.08);
      c.index = Math.max(0.25, c.index * (1 + swing));
      addNews(s, item.text.replace('{city}', c.name), `The ${c.name} index moved ${(swing * 100).toFixed(1)}% on the news.`, item.tone);
    }
  }

  if (rt.historyTimer <= TUNING.historyIntervalSeconds * 0.5) {
    for (const c of s.cities) {
      c.history.push(c.index);
      if (c.history.length > TUNING.priceHistoryLength) c.history.shift();
    }
  }
}

function stepLuxury(s: GameState, dt: number, rt: SimRuntime): void {
  rt.luxuryTimer -= dt;
  if (rt.luxuryTimer > 0) return;
  const elapsed = TUNING.luxuryRevalueSeconds;
  rt.luxuryTimer = TUNING.luxuryRevalueSeconds;

  for (const owned of s.luxury) {
    const def = LUXURY_BY_ID[owned.itemId];
    if (!def) continue;
    const perSecond = def.appreciation / TUNING.secondsPerGameYear;
    const noise = 1 + range(-0.0015, 0.0015);
    owned.value = Math.max(def.price * 0.15, owned.value * (1 + perSecond * elapsed) * noise);
  }
}

function stepListings(s: GameState, dt: number, rt: SimRuntime): void {
  rt.listingTimer -= dt;
  if (rt.listingTimer > 0) return;
  rt.listingTimer = TUNING.listingRefreshSeconds;

  // Unowned listings churn so the market always looks alive. Owned property is
  // never touched.
  s.properties = s.properties.filter((p) => p.owned || chance(0.6));

  // ...and then the market restocks. Without this the churn is one-directional
  // and every city eventually drains to an empty listings page.
  const nw = netWorth(s);
  for (const city of s.cities) {
    const unlocked = nw >= city.unlockAt || s.properties.some((p) => p.cityId === city.id && p.owned);
    if (!unlocked) continue;
    const open = s.properties.filter((p) => p.cityId === city.id && !p.owned);
    // Commercial units house businesses and land is the only developable kind,
    // so both must stay purchasable. Restock those first, then fill the rest.
    const needed: PropertyKind[] = [];
    if (!open.some((p) => p.kind === 'commercial')) needed.push('commercial');
    if (!open.some((p) => p.kind === 'land')) needed.push('land');

    const missing = Math.max(needed.length, TUNING.listingsPerCity - open.length);
    for (let i = 0; i < missing; i++) {
      s.properties.push(generateListing(city.id, needed[i]));
    }
  }
}

// ------------------------------------------------------------------ events

function stepEvents(s: GameState, dt: number): void {
  // Memory tags fade, so a business recovers from a bad run rather than
  // carrying it forever.
  for (const b of s.businesses) {
    for (const tag of Object.keys(b.tags)) {
      const remaining = b.tags[tag] - dt;
      if (remaining <= 0) delete b.tags[tag];
      else b.tags[tag] = remaining;
    }
  }

  // Chained follow-ups jump the normal cooldown — they are the second act of
  // a decision the player already made.
  for (const scheduled of s.scheduledEvents) scheduled.fireIn -= dt;
  const due = s.scheduledEvents.filter((e) => e.fireIn <= 0);
  s.scheduledEvents = s.scheduledEvents.filter((e) => e.fireIn > 0);
  for (const item of due) {
    if (item.businessId && !s.businesses.some((b) => b.id === item.businessId)) continue;
    queueCard(s, item.defId, item.businessId);
  }

  // Expire stale cards so the queue never becomes a chore.
  for (const e of s.pendingEvents) e.expiresIn -= dt;
  const expired = s.pendingEvents.filter((e) => e.expiresIn <= 0);
  for (const e of expired) {
    const def = cardById(s, e.defId);
    if (def) addLog(s, `You let "${def.title}" pass without a decision.`, 'neutral');
  }
  s.pendingEvents = s.pendingEvents.filter((e) => e.expiresIn > 0);

  for (const b of s.businesses) {
    b.eventCooldown -= dt;
    if (b.eventCooldown > 0) continue;
    // A premises with problems surfaces them more often; a quiet street less.
    b.eventCooldown =
      range(TUNING.eventCooldownMin, TUNING.eventCooldownMax) * traitEventRate(b.traits);

    const card = pickCardFor(s, b);
    if (!card) continue;

    const manager = MANAGER_BY_TIER[b.manager];
    if (manager.efficiency > 0 && s.settings.autoResolveManaged) {
      autoResolve(s, b.id, card.id, manager.efficiency);
      continue;
    }

    queueCard(s, card.id, b.id);
  }
}

/** Pushes a card into the decision queue, evicting the oldest if full. */
function queueCard(s: GameState, defId: string, businessId: string | null): void {
  // A full queue drops the *oldest* card, not the new one. Silently
  // discarding fresh cards made large empires stop generating decisions.
  if (s.pendingEvents.length >= TUNING.maxPendingEvents) {
    const dropped = s.pendingEvents.shift();
    if (dropped) {
      const droppedDef = cardById(s, dropped.defId);
      if (droppedDef) {
        addLog(s, `"${droppedDef.title}" went stale while other decisions piled up.`, 'neutral');
      }
    }
  }

  s.pendingEvents.push({
    uid: uid('ev'),
    defId,
    businessId,
    createdAt: Date.now(),
    expiresIn: TUNING.eventExpirySeconds,
  });
}

function isDrawable(c: EventCardDef, b: Business): boolean {
  return (
    !c.chainOnly &&
    (c.minLevel ?? 1) <= b.level &&
    (!c.requiresTag || b.tags[c.requiresTag] !== undefined) &&
    (!c.excludesTag || b.tags[c.excludesTag] === undefined) &&
    (!c.requiresTrait || b.traits.includes(c.requiresTrait)) &&
    (!c.excludesTrait || !b.traits.includes(c.excludesTrait))
  );
}

function pickCardFor(s: GameState, b: Business) {
  // Category and empire-wide cards are both always in the pool. Sampling the
  // empire deck only some of the time made the pool size fluctuate, which
  // collapsed the memory window and let repeats through early.
  // A design's own cards sit alongside its archetype's, not instead of them: a
  // generated deck is at most sixteen cards and would repeat itself within
  // minutes on its own, while the authored deck it inherits is the reason the
  // business still surprises you an hour in.
  const categoryPool = [
    ...(EVENTS_BY_CATEGORY[b.category] ?? []),
    ...designCards(s, b.designId),
  ].filter((c) => isDrawable(c, b));
  const generalPool = (EVENTS_BY_CATEGORY['any'] ?? []).filter((c) => isDrawable(c, b));
  const pool = [...categoryPool, ...generalPool];
  if (pool.length === 0) return null;

  // Draw without replacement: exclude anything queued, plus the cards this
  // business has seen most recently. The memory window scales with the pool,
  // so adding cards directly extends the time before a repeat rather than
  // being washed out by random collisions.
  const queued = new Set(s.pendingEvents.map((e) => e.defId));
  const memory = Math.floor(pool.length * TUNING.deckMemoryRatio);
  const recent = new Set(b.recentCards.slice(-memory));

  const eligible = (list: EventCardDef[]) =>
    list.filter((c) => !queued.has(c.id) && !recent.has(c.id));

  let freshCategory = eligible(categoryPool);
  let freshGeneral = eligible(generalPool);
  if (freshCategory.length === 0 && freshGeneral.length === 0) {
    // Memory window exhausted — fall back to anything not currently queued.
    freshCategory = categoryPool.filter((c) => !queued.has(c.id));
    freshGeneral = generalPool.filter((c) => !queued.has(c.id));
  }

  // Category cards are the point of the deck; empire cards are seasoning.
  const preferCategory = freshCategory.length > 0 && (freshGeneral.length === 0 || chance(0.72));
  const source = preferCategory ? freshCategory : freshGeneral.length > 0 ? freshGeneral : pool;
  const card = pick(source);

  b.recentCards.push(card.id);
  if (b.recentCards.length > 120) b.recentCards.shift();
  return card;
}

/** A managed business picks the safest option and takes a reduced payoff. */
function autoResolve(s: GameState, businessId: string, defId: string, efficiency: number): void {
  const def = cardById(s, defId);
  if (!def) return;
  // Managers are risk-averse: they take the highest-odds choice available.
  let bestIndex = 0;
  for (let i = 1; i < def.choices.length; i++) {
    if (def.choices[i].odds > def.choices[bestIndex].odds) bestIndex = i;
  }
  resolveEventChoice(s, businessId, defId, bestIndex, { efficiency, silent: true });
}

// ----------------------------------------------------------------- offline

const CURVE_POINTS = 24;
/** Beyond this the report stops being read. */
const MAX_NOTES = 6;

/**
 * Fast-forwards the empire for time spent away. Runs at a reduced rate and is
 * capped, so being away is always worse than playing — but never wasted.
 *
 * It also reports. Coming back to a single number told the player nothing about
 * what their empire had actually been doing, so the loop is instrumented:
 * income is attributed to its source, net worth is sampled for a curve, and
 * anything worth remarking on — a development finishing, a ticker moving hard,
 * somebody passing ten years of service — is collected as it happens.
 */
export function simulateOffline(s: GameState, elapsedSeconds: number, capSeconds: number): OfflineResult {
  const capped = elapsedSeconds > capSeconds;
  const seconds = Math.min(elapsedSeconds, capSeconds);

  const before = s.cash;
  const netWorthBefore = netWorth(s);
  const rt = createRuntime();

  // Snapshots taken before anything moves, so the report can diff against them.
  const pricesBefore = new Map(s.assets.map((a) => [a.id, a.price]));
  const indicesBefore = new Map(s.cities.map((c) => [c.id, c.index]));
  const buildingBefore = new Set(s.properties.filter((p) => p.development).map((p) => p.id));
  const boostsBefore = new Map(s.boosts.map((b) => [b.id, b.label]));
  const rollsBefore = s.rollTokens;
  // Tenure runs on the wall clock, and by the time this is called the clock has
  // already advanced past the absence. Measuring "before" at Date.now() would
  // compare the present against itself, so no one could ever be seen crossing a
  // milestone. The baseline is the moment the player actually left — the full
  // elapsed time, not the capped simulation window, because service accrues
  // whether or not the offline earnings did.
  const awayStart = Date.now() - elapsedSeconds * 1000;
  const serviceBefore = new Map<string, number>();
  for (const b of s.businesses) {
    for (const m of b.roster) serviceBefore.set(m.id, serviceYears(m, awayStart));
  }

  let fromBusinesses = 0;
  let fromProperty = 0;
  let debtRepaid = 0;
  let interestAccrued = 0;
  const curve: number[] = [netWorthBefore];
  const sampleEvery = seconds / CURVE_POINTS;
  let sinceSample = 0;

  // Coarse steps: enough resolution for prices and developments to move
  // sensibly, cheap enough to run instantly for a multi-hour absence.
  const stepSize = 10;
  let remaining = seconds;
  while (remaining > 0) {
    const dt = Math.min(stepSize, remaining);

    // Income accrues at the offline rate; everything else runs normally so
    // markets, developments and city indices are current when you return.
    // Businesses and property are stepped separately only so the report can
    // say which of them earned what.
    const beforeBusinesses = s.cash;
    stepBusinesses(s, dt);
    const businessEarned = (s.cash - beforeBusinesses) * TUNING.offlineRate;
    s.cash = beforeBusinesses + businessEarned;
    fromBusinesses += businessEarned;

    const beforeProperty = s.cash;
    stepProperties(s, dt);
    const propertyEarned = (s.cash - beforeProperty) * TUNING.offlineRate;
    s.cash = beforeProperty + propertyEarned;
    fromProperty += propertyEarned;

    const cashBeforeDebt = s.cash;
    const owedBeforeDebt = totalDebt(s);
    stepDebt(s, dt);
    const repaid = cashBeforeDebt - s.cash;
    debtRepaid += repaid;
    // Interest grows the principal rather than taking cash, so it has to be
    // read off the balance: whatever the debt grew by, plus whatever was paid
    // down out of cash in the same step.
    interestAccrued += totalDebt(s) - owedBeforeDebt + repaid;

    stepBoosts(s, dt);
    stepRolls(s, dt);
    stepMarkets(s, dt, rt);
    stepCities(s, dt, rt);
    stepLuxury(s, dt, rt);

    sinceSample += dt;
    if (sinceSample >= sampleEvery && curve.length < CURVE_POINTS) {
      curve.push(netWorth(s));
      sinceSample = 0;
    }

    remaining -= dt;
  }

  coverShortfall(s);
  const nw = netWorth(s);
  if (nw > s.stats.peakNetWorth) s.stats.peakNetWorth = nw;
  curve.push(nw);

  return {
    seconds,
    earned: s.cash - before,
    capped,
    fromBusinesses,
    fromProperty,
    debtRepaid,
    interestAccrued,
    netWorthBefore,
    netWorthAfter: nw,
    curve,
    rollsGained: Math.max(0, s.rollTokens - rollsBefore),
    notes: collectNotes(s, {
      pricesBefore,
      indicesBefore,
      buildingBefore,
      boostsBefore,
      serviceBefore,
      interestAccrued,
    }),
  };
}

interface NoteContext {
  pricesBefore: Map<string, number>;
  indicesBefore: Map<string, number>;
  buildingBefore: Set<string>;
  boostsBefore: Map<string, string>;
  serviceBefore: Map<string, number>;
  interestAccrued: number;
}

/**
 * What is worth telling the player about.
 *
 * Deliberately selective and hard-capped. Everything that moved would be a
 * wall of text, and a wall of text is the same as no report at all — the
 * player skims it and taps through. So each kind of note has its own budget,
 * they are appended in priority order, and the whole list is truncated.
 *
 * Long service is the note most at risk of becoming noise: a game year is
 * two and a half real minutes, so an hour away is twenty-four years and
 * everybody crosses something. Only the milestones that read as an
 * achievement count, and more than a couple are collapsed into one line.
 */
function collectNotes(s: GameState, ctx: NoteContext): OfflineNote[] {
  const notes: OfflineNote[] = [];

  // Developments that finished — the thing most worth coming back for, so it
  // goes first and gets the largest budget.
  const completed = s.properties.filter(
    (p) => ctx.buildingBefore.has(p.id) && !p.development && p.developedType,
  );
  for (const p of completed.slice(0, 3)) {
    const dev = DEVELOPMENT_BY_TYPE[p.developedType!];
    notes.push({
      icon: '🏗',
      text: `${dev?.label ?? 'Development'} finished at ${p.name}.`,
      tone: 'good',
    });
  }
  if (completed.length > 3) {
    notes.push({ icon: '🏗', text: `${completed.length - 3} more builds completed.`, tone: 'good' });
  }

  // People passing a round number of years. This is the one note that is not
  // about money, and it is the reason the roster exists.
  const MILESTONES = [5, 10, 25];
  const milestones: { name: string; at: string; years: number }[] = [];
  for (const b of s.businesses) {
    for (const m of b.roster) {
      const wasAt = ctx.serviceBefore.get(m.id);
      if (wasAt === undefined) continue;
      const nowAt = serviceYears(m);
      const crossed = MILESTONES.filter((y) => wasAt < y && nowAt >= y).pop();
      if (crossed !== undefined) milestones.push({ name: m.name, at: b.name, years: crossed });
    }
  }
  // Biggest milestone first, so if only one line survives it is the best one.
  milestones.sort((a, b) => b.years - a.years);
  if (milestones.length <= 2) {
    for (const ms of milestones) {
      notes.push({ icon: '🎖', text: `${ms.name} passed ${ms.years} years at ${ms.at}.`, tone: 'good' });
    }
  } else {
    const top = milestones[0];
    notes.push({ icon: '🎖', text: `${top.name} passed ${top.years} years at ${top.at}.`, tone: 'good' });
    notes.push({
      icon: '🎖',
      text: `${milestones.length - 1} others reached long-service milestones.`,
      tone: 'good',
    });
  }

  // The single biggest mover each way, and only if it actually moved.
  const moves = s.assets
    .map((a) => ({ a, change: (a.price - (ctx.pricesBefore.get(a.id) ?? a.price)) / (ctx.pricesBefore.get(a.id) || 1) }))
    .sort((x, y) => y.change - x.change);
  const best = moves[0];
  const worst = moves[moves.length - 1];
  if (best && best.change > 0.08) {
    notes.push({ icon: '📈', text: `${best.a.ticker} up ${(best.change * 100).toFixed(0)}%.`, tone: 'good' });
  }
  if (worst && worst.change < -0.08) {
    notes.push({ icon: '📉', text: `${worst.a.ticker} down ${Math.min(99, -worst.change * 100).toFixed(0)}%.`, tone: 'bad' });
  }

  const cityMoves = s.cities
    .map((c) => ({ c, change: (c.index - (ctx.indicesBefore.get(c.id) ?? c.index)) / (ctx.indicesBefore.get(c.id) || 1) }))
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
  if (cityMoves[0] && Math.abs(cityMoves[0].change) > 0.03) {
    const { c, change } = cityMoves[0];
    notes.push({
      icon: '🏙',
      text: `${c.name} property ${change > 0 ? 'up' : 'down'} ${(Math.abs(change) * 100).toFixed(0)}%.`,
      tone: change > 0 ? 'good' : 'bad',
    });
  }

  // Boosts that ran out while you were not looking.
  const expired = [...ctx.boostsBefore.entries()].filter(([id]) => !s.boosts.some((b) => b.id === id));
  if (expired.length === 1) {
    notes.push({ icon: '⏳', text: `${expired[0][1]} ran out.`, tone: 'neutral' });
  } else if (expired.length > 1) {
    notes.push({ icon: '⏳', text: `${expired.length} boosts ran out.`, tone: 'neutral' });
  }

  if (ctx.interestAccrued > 0) {
    notes.push({
      icon: '🏦',
      text: `Your debt grew ${money(ctx.interestAccrued)} in interest.`,
      tone: 'bad',
    });
  }

  return notes.slice(0, MAX_NOTES);
}


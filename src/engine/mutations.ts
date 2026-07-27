import type { Boost, CategoryId, GameState, LogEntry, NewsItem, Rarity } from './types';
import { TUNING } from './content/tuning';
import { uid } from './rng';

/**
 * Small in-place mutators shared by the simulation and the action reducer.
 * The game state is deliberately mutated rather than copied: it is a single
 * large object ticking several times a second, and structural sharing buys
 * nothing here.
 */

export function addLog(s: GameState, text: string, tone: LogEntry['tone'] = 'neutral'): void {
  s.log.unshift({ id: uid('log'), at: Date.now(), text, tone });
  if (s.log.length > TUNING.maxLog) s.log.length = TUNING.maxLog;
}

export function addNews(s: GameState, headline: string, detail: string, tone: NewsItem['tone']): void {
  s.news.unshift({ id: uid('news'), headline, detail, at: Date.now(), tone });
  if (s.news.length > TUNING.maxNews) s.news.length = TUNING.maxNews;
}

export function setFlash(
  s: GameState,
  text: string,
  tone: LogEntry['tone'] = 'neutral',
  rarity?: Rarity,
): void {
  s.flash = { id: uid('flash'), text, tone, rarity };
}

export function addCash(s: GameState, amount: number): void {
  s.cash += amount;
  if (amount > 0) s.stats.totalEarned += amount;
}

export function addBoost(
  s: GameState,
  opts: {
    label: string;
    kind: Boost['kind'];
    power: number;
    duration: number;
    rarity?: Rarity;
    category?: CategoryId | null;
  },
): void {
  const boost: Boost = {
    id: uid('boost'),
    label: opts.label,
    kind: opts.kind,
    power: opts.power,
    duration: opts.duration,
    remaining: opts.duration,
    rarity: opts.rarity ?? 'common',
    category: opts.category ?? null,
  };

  // Stacking the same buff twice refreshes and extends rather than duplicating,
  // which keeps the active-boost list readable.
  const existing = s.boosts.find(
    (b) => b.label === boost.label && b.kind === boost.kind && b.category === boost.category,
  );
  if (existing) {
    existing.remaining = Math.max(existing.remaining, boost.remaining) + boost.duration * 0.25;
    existing.power = Math.max(existing.power, boost.power);
    return;
  }

  s.boosts.push(boost);
}

export function grantRolls(s: GameState, n: number): void {
  s.rollTokens = Math.min(TUNING.maxRollTokens, s.rollTokens + n);
}

export function clampMorale(value: number): number {
  return Math.min(TUNING.moraleMax, Math.max(TUNING.moraleMin, value));
}

/** Take on debt automatically when cash would go negative. */
export function coverShortfall(s: GameState): void {
  if (s.cash >= 0) return;
  const shortfall = -s.cash;
  s.cash = 0;
  const existing = s.debt.find((l) => l.id === 'auto');
  if (existing) {
    existing.principal += shortfall;
  } else {
    s.debt.push({
      id: 'auto',
      principal: shortfall,
      // Emergency credit is priced punitively; the player can refinance on the
      // Debt screen by taking a cheaper loan and repaying this.
      rate: (TUNING.loanBaseAnnualRate * 1.8) / TUNING.secondsPerGameYear,
      takenAt: Date.now(),
    });
    addLog(s, 'You went into the red. Emergency credit line opened at a brutal rate.', 'bad');
  }
}

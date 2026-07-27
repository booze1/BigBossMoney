import type { Boost, Business, CategoryId, GameState, LogEntry, NewsItem, Rarity, StaffMember } from './types';
import { TUNING } from './content/tuning';
import { uid } from './rng';
import { roleFor, staffName } from './content/staff';

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
      // Dearer than a normal loan, but not ruinous — the financial year is
      // only 150s, so interest compounds fast enough already.
      rate: (TUNING.loanBaseAnnualRate * 1.35) / TUNING.secondsPerGameYear,
      takenAt: Date.now(),
    });
    addLog(
      s,
      'Your cash ran out. An emergency credit line covered the shortfall — ' +
        'repay it on the Debt screen before the interest builds.',
      'bad',
    );
  }
}

/**
 * Puts someone on the books. Names are unique within a business, and the hire
 * time is what every tenure figure is derived from later.
 */
export function hire(b: Business): StaffMember {
  const member: StaffMember = {
    id: uid('staff'),
    name: staffName(b.roster.map((m) => m.name)),
    role: roleFor(b.category),
    hiredAt: Date.now(),
  };
  b.roster.push(member);
  return member;
}

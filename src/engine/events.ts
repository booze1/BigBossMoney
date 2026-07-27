import type { Business, EventOutcome, GameState } from './types';
import { TUNING } from './content/tuning';
import { CATEGORY_BY_ID } from './content/businesses';
import { EVENT_BY_ID } from './content/events';
import { empireIncomeMultiplier, maxStaff, saturationMultiplier, totalLuck } from './selectors';
import { addBoost, addCash, addLog, clampMorale, grantRolls } from './mutations';
import { chance } from './rng';
import { money } from './format';

/**
 * Event card resolution. This is the main place skill and luck meet: the
 * player picks a line, the Luck stat quietly improves the odds, and the
 * outcome is scaled to the business's size so a card written once stays
 * meaningful across the whole run.
 */

export interface EventResolution {
  success: boolean;
  text: string;
  effects: string[];
  odds: number;
}

/** How much the Luck stat improves a card's stated odds. */
export function luckOddsBonus(s: GameState): number {
  return Math.min(TUNING.maxLuckOddsBonus, totalLuck(s) * TUNING.luckOddsPerPoint);
}

export function effectiveOdds(s: GameState, odds: number): number {
  if (odds >= 1) return 1;
  return Math.min(0.97, odds + luckOddsBonus(s));
}

/**
 * The per-second figure that `cashSeconds` outcomes are denominated in.
 * Deliberately excludes temporary boosts so a card's payout does not swing
 * wildly depending on what buffs happen to be running.
 */
function payoutBaseline(s: GameState, businessId: string | null): number {
  const b = businessId ? s.businesses.find((x) => x.id === businessId) : undefined;
  if (!b) {
    const largest = s.businesses.map((x) => baselineFor(s, x)).sort((p, q) => q - p)[0];
    return largest ?? 25;
  }
  return baselineFor(s, b);
}

function baselineFor(s: GameState, b: Business): number {
  const def = CATEGORY_BY_ID[b.category];
  const levelRevenue =
    def.baseRevenue * Math.pow(TUNING.revenuePerLevel, b.level - 1) * saturationMultiplier(s, b);
  return levelRevenue * (1 - def.upkeepRatio) * empireIncomeMultiplier(s);
}

export function resolveEventChoice(
  s: GameState,
  businessId: string | null,
  defId: string,
  choiceIndex: number,
  opts: { efficiency?: number; silent?: boolean } = {},
): EventResolution | null {
  const def = EVENT_BY_ID[defId];
  if (!def) return null;
  const choice = def.choices[choiceIndex];
  if (!choice) return null;

  const efficiency = opts.efficiency ?? 1;
  const odds = effectiveOdds(s, choice.odds);
  const success = odds >= 1 || chance(odds);
  const outcome = success ? choice.good : choice.bad;

  const business = businessId ? s.businesses.find((b) => b.id === businessId) : undefined;
  const volatility = business ? CATEGORY_BY_ID[business.category].volatility : 1;
  const baseline = payoutBaseline(s, businessId);

  const effects = applyOutcome(s, outcome, {
    businessId,
    baseline,
    volatility,
    efficiency,
  });

  s.stats.eventsResolved += 1;

  const text = outcome.text || (success ? choice.good.text : choice.bad.text);
  if (!opts.silent) {
    addLog(s, `${def.title} — ${text}`, success ? 'good' : 'bad');
  } else if (Math.abs(effects.cashDelta) > baseline * 40) {
    // Managed businesses stay quiet unless something genuinely notable happens.
    const label = business ? business.name : 'Your empire';
    addLog(
      s,
      `${label}: manager handled "${def.title}" — ${money(effects.cashDelta, { sign: true })}`,
      effects.cashDelta >= 0 ? 'good' : 'bad',
    );
  }

  return { success, text, effects: effects.lines, odds };
}

interface ApplyContext {
  businessId: string | null;
  baseline: number;
  volatility: number;
  efficiency: number;
}

function applyOutcome(
  s: GameState,
  outcome: EventOutcome,
  ctx: ApplyContext,
): { lines: string[]; cashDelta: number } {
  const lines: string[] = [];
  const business = ctx.businessId ? s.businesses.find((b) => b.id === ctx.businessId) : undefined;

  // Gains are scaled down by manager efficiency; losses are not. Playing a
  // card by hand is always at least as good as delegating it.
  const gainScale = ctx.efficiency;
  let cashDelta = 0;

  if (outcome.cash) {
    const amount = outcome.cash > 0 ? outcome.cash * gainScale : outcome.cash;
    cashDelta += amount;
  }

  if (outcome.cashSeconds) {
    const raw = outcome.cashSeconds * ctx.baseline * ctx.volatility * TUNING.cashSecondsScale;
    cashDelta += raw > 0 ? raw * gainScale : raw;
  }

  if (cashDelta !== 0) {
    addCash(s, cashDelta);
    lines.push(`${money(cashDelta, { sign: true })}`);
  }

  if (outcome.morale && business) {
    const delta = outcome.morale > 0 ? outcome.morale * gainScale : outcome.morale;
    business.morale = clampMorale(business.morale + delta);
    lines.push(`${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}% morale`);
  }

  if (outcome.staff && business) {
    const before = business.staff;
    business.staff = Math.max(0, Math.min(maxStaff(business), business.staff + outcome.staff));
    const delta = business.staff - before;
    if (delta !== 0) lines.push(`${delta > 0 ? '+' : ''}${delta} staff`);
  }

  if (outcome.boost) {
    const power =
      outcome.boost.power > 1
        ? 1 + (outcome.boost.power - 1) * gainScale
        : outcome.boost.power;
    addBoost(s, {
      label: outcome.boost.label,
      kind: outcome.boost.kind,
      power,
      duration: outcome.boost.duration,
      rarity: power >= 2 ? 'epic' : power >= 1.5 ? 'rare' : 'uncommon',
      category: outcome.boost.scope === 'business' && business ? business.category : null,
    });
    lines.push(`${outcome.boost.label} ×${power.toFixed(2)} for ${Math.round(outcome.boost.duration / 60)}m`);
  }

  if (outcome.luck) {
    const delta = outcome.luck > 0 ? outcome.luck * gainScale : outcome.luck;
    s.luck = Math.max(0, s.luck + delta);
    lines.push(`${delta > 0 ? '+' : ''}${delta.toFixed(0)} Luck`);
  }

  if (outcome.rolls) {
    const n = Math.max(1, Math.round(outcome.rolls * gainScale));
    grantRolls(s, n);
    lines.push(`+${n} roll${n === 1 ? '' : 's'}`);
  }

  return { lines, cashDelta };
}

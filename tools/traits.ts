/**
 * Prices the premises traits.
 *
 * A trait's asking multiplier has to match what the trait is actually worth,
 * or the shortlist stops being a decision: underprice the flaws and the bargain
 * is strictly correct every time, overprice them and nobody sensible ever takes
 * one. Reasoning about it from the numbers in traits.ts by hand does not work,
 * because a trait moves four things at once and two of them — how often cards
 * arrive and how hard they hit — only reach the income statement through play.
 *
 * The first version of this measured everything by simulation and was useless:
 * earnings over ten minutes span p05 35k to p95 227k, so a control group
 * measured against a second control group came back anywhere from 0.96 to 1.07.
 * That is a wider error bar than most of the effects being measured, and no
 * affordable number of trials closes it — the standard error of a mean falls
 * like 1/sqrt(N) against a coefficient of variation near 0.9.
 *
 * So almost nothing is simulated now. A business's earnings split into two
 * streams, and both respond to traits in closed form:
 *
 *   ticker income  scales with revenue, upkeep and the staff cap — all exactly
 *                  computable from businessFinancials, with no noise at all.
 *   card income    scales with how often cards arrive, which is exactly
 *                  1 / eventRate, raised to a power because cards compound.
 *
 * That leaves one number to measure: what share of a plain business's earnings
 * comes from cards rather than the ticker. It is measured once, with the ticker
 * half computed exactly rather than sampled, so the noise lands on one figure
 * instead of thirty-two.
 *
 * The measurement also kept a lever honest. `stakes` used to scale the cash
 * swing of a card outcome, the idea being that a flood-risk site should be
 * volatile. Instrumenting the wins and losses separately showed why it could
 * never work: over a ten-minute run cards take 6,858 and give back 2,084, so
 * card *cash* is firmly negative and what cards actually pay is the boosts they
 * grant. Scaling both directions therefore made a risky premises worth more
 * than a safe one; scaling only the downside moved the total by 2%. A lever
 * that cannot be felt and cannot be priced is worse than no lever, so it was
 * removed and those traits re-expressed in revenue and upkeep instead.
 *
 *   npx tsx tools/traits.ts
 *   TRIALS=600 npx tsx tools/traits.ts
 */
import { createInitialState } from '../src/engine/state';
import { createRuntime, step } from '../src/engine/sim';
import { apply } from '../src/engine/actions';
import { TRAITS } from '../src/engine/content/traits';
import { businessFinancials } from '../src/engine/selectors';
import type { CategoryId, GameState } from '../src/engine/types';

const TRIALS = Number(process.env.TRIALS ?? 400);
const SECONDS = 600;
const LEVEL = 5;
const STAFF = 2;
const FREQUENCY_EXPONENT = 1.6;

function rig(category: CategoryId, traits: string[], staff = STAFF): GameState {
  const s = createInitialState();
  s.cash = 0;
  const b = s.businesses[0];
  b.category = category;
  b.level = LEVEL;
  b.staff = staff;
  b.traits = [...traits];
  s.businesses = [b];
  // Markets, property and luck all move money for reasons unrelated to the
  // premises.
  s.assets = [];
  s.holdings = [];
  s.properties = [];
  s.luck = 0;
  return s;
}

/** Exact per-second net income. No simulation, no noise. */
function tickerNet(category: CategoryId, traits: string[], staff = STAFF): number {
  const s = rig(category, traits, staff);
  return businessFinancials(s, s.businesses[0]).net;
}

/**
 * One run. Returns total earnings plus the split of card cash into wins and
 * losses — the split is what revealed that card cash is net negative and that
 * cards pay through boosts, which is reported so the finding stays visible.
 */
function simulate(
  category: CategoryId,
  traits: string[],
): { total: number; won: number; lost: number } {
  const s = rig(category, traits);
  const rt = createRuntime();
  let won = 0;
  let lost = 0;
  for (let t = 0; t < SECONDS; t += 0.5) {
    step(s, 0.5, rt);
    for (const ev of [...s.pendingEvents]) {
      const before = s.cash;
      apply(s, { type: 'resolveEvent', eventUid: ev.uid, choiceIndex: 0 });
      const delta = s.cash - before;
      if (delta >= 0) won += delta;
      else lost += -delta;
    }
  }
  return { total: s.cash, won, lost };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ------------------------------------------------------- the one measurement
//
// Everything downstream hangs off this: how much of a business's income is the
// cards rather than the ticker.

const controlCategory: CategoryId = 'retail';
const tickerTotal = tickerNet(controlCategory, []) * SECONDS;

const runs = Array.from({ length: TRIALS }, () => simulate(controlCategory, []));
const totals = runs.map((r) => r.total);
const observed = mean(totals);
const se = Math.sqrt(mean(totals.map((r) => (r - observed) ** 2)) / TRIALS);

const cardShare = Math.min(0.95, Math.max(0, 1 - tickerTotal / observed));
const cardShareError = (se / observed) * (1 - cardShare);

const won = mean(runs.map((r) => r.won));
const lost = mean(runs.map((r) => r.lost));

console.log(`\ncard share of earnings: ${(cardShare * 100).toFixed(1)}% ± ${(cardShareError * 100).toFixed(1)}pp`);
console.log(`  (ticker ${tickerTotal.toFixed(0)} exact, total ${observed.toFixed(0)} over ${TRIALS} runs)`);
console.log(`card cash: won ${won.toFixed(0)}, lost ${lost.toFixed(0)}, net ${(won - lost).toFixed(0)}\n`);

// ------------------------------------------------------------------ pricing

const rows = TRAITS.map((trait) => {
  const category = (trait.categories?.[0] ?? 'retail') as CategoryId;

  // Ticker side, exact. Staff is capped, so a trait that moves the cap is
  // measured at a headcount that actually differs.
  const staff = STAFF + Math.max(0, -(trait.staffCap ?? 0));
  const ticker = tickerNet(category, [trait.id], staff) / tickerNet(category, [], staff);

  // Card side. Frequency is superlinear: cards grant boosts and morale, which
  // multiply ticker income for the rest of the run, so drawing more cards
  // compounds rather than adding.
  // Simulating four card-heavy traits and solving for the exponent gave 0.86,
  // 1.37, 1.73 and 2.30 — each of those is a log ratio of two ±6% figures, so
  // the spread is mostly measurement error. FREQUENCY_EXPONENT is the middle
  // of them, and the eventRate values are deliberately kept near 1 so that
  // being wrong about it stays cheap.
  const cards = Math.pow(1 / (trait.eventRate ?? 1), FREQUENCY_EXPONENT);

  const fair = ticker * (1 - cardShare) + cards * cardShare;
  return { trait, ticker, cards, fair, authored: trait.price ?? 1 };
});

rows.sort((a, b) => a.fair - b.fair);

console.log('trait                     tone    ticker  cards    fair   authored  verdict');
for (const r of rows) {
  const skew = r.authored / r.fair;
  const verdict = skew < 0.95 ? 'UNDERPRICED' : skew > 1.05 ? 'OVERPRICED' : 'fair';
  console.log(
    `${r.trait.id.padEnd(24)} ${r.trait.tone.padEnd(6)} ` +
      `${r.ticker.toFixed(3)}  ${r.cards.toFixed(3)}  ${r.fair.toFixed(3)}   ` +
      `${r.authored.toFixed(2).padStart(6)}   ${verdict}`,
  );
}

// Emitted so the prices in traits.ts can be set from the measurement rather
// than from taste.
console.log('\nsuggested price values:');
for (const r of [...rows].sort((a, b) => a.trait.id.localeCompare(b.trait.id))) {
  // No tilt. The cross-check shows the model runs about 4% generous on traits
  // that slow the card rate, which is the same size as the error bar, so any
  // deliberate thumb on the scale here would be indistinguishable from being
  // wrong. Pricing at fair and validating the result end to end with
  // tools/pacing.ts is the honest loop.
  console.log(`  ${r.trait.id.padEnd(24)} price: ${r.fair.toFixed(2)},`);
}

// A spot-check that the closed form matches reality on the traits where the
// card term does the most work — if these disagree badly the model is wrong.
console.log('\ncross-check against simulation (the card-heavy traits):');
for (const id of ['built_on_a_weekend', 'tourist_trap', 'quiet_street', 'vermin']) {
  const row = rows.find((r) => r.trait.id === id)!;
  const category = (row.trait.categories?.[0] ?? 'retail') as CategoryId;
  const treated: number[] = [];
  const control: number[] = [];
  for (let i = 0; i < TRIALS; i++) {
    treated.push(simulate(category, [id]).total);
    control.push(simulate(category, []).total);
  }
  const measured = mean(treated) / mean(control);
  console.log(
    `  ${id.padEnd(24)} predicted ${row.fair.toFixed(3)}  simulated ${measured.toFixed(3)}`,
  );
}

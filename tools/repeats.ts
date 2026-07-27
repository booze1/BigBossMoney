/**
 * Measures event-deck repeat pressure: how long a business goes before it
 * sees the same card twice, and how much distinct content it gets through.
 *
 *   npx tsx tools/repeats.ts
 */
import { createInitialState } from '../src/engine/state';
import { createRuntime, step } from '../src/engine/sim';
import { apply } from '../src/engine/actions';
import type { CategoryId } from '../src/engine/types';

function measure(category: CategoryId, minutes: number, levelUp: boolean) {
  const s = createInitialState();
  const rt = createRuntime();
  s.cash = 1e12;
  if (category !== 'retail') apply(s, { type: 'buyBusiness', category });
  const b = s.businesses[s.businesses.length - 1];

  const seen: string[] = [];
  let firstRepeat: number | null = null;

  for (let t = 0; t < minutes * 60; t += 0.5) {
    step(s, 0.5, rt);
    // A real business levels up as the run goes on, unlocking gated cards.
    if (levelUp && b.level < 6 && t > 0 && Math.round(t) % 420 === 0) b.level++;

    for (const ev of [...s.pendingEvents]) {
      if (ev.businessId === b.id) {
        if (seen.includes(ev.defId) && firstRepeat === null) firstRepeat = t;
        seen.push(ev.defId);
      }
      apply(s, { type: 'resolveEvent', eventUid: ev.uid, choiceIndex: 0 });
    }
    s.rollTokens = 0; // isolate the card system
  }

  return { drawn: seen.length, distinct: new Set(seen).size, firstRepeat };
}

const MINUTES = 90;
console.log(`Per-business deck pressure over ${MINUTES} minutes\n`);
console.log('category     level   drawn  distinct  first repeat');
for (const category of ['retail', 'restaurant', 'nightclub', 'tech', 'bank', 'devco'] as CategoryId[]) {
  for (const [label, levelUp] of [['fixed L1', false], ['levelling', true]] as [string, boolean][]) {
    const r = measure(category, MINUTES, levelUp);
    const repeat = r.firstRepeat === null ? 'never' : `${(r.firstRepeat / 60).toFixed(1)} min`;
    console.log(
      `${category.padEnd(12)} ${label.padEnd(10)} ${String(r.drawn).padStart(3)}` +
        `   ${String(r.distinct).padStart(4)}      ${repeat}`,
    );
  }
}

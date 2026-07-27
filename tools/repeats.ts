import { createInitialState } from '../src/engine/state';
import { createRuntime, step } from '../src/engine/sim';
import { apply } from '../src/engine/actions';

// Single-business run: how long until the card deck starts repeating?
const s = createInitialState();
const rt = createRuntime();
const seen: string[] = [];
let firstRepeatAt: number | null = null;

for (let t = 0; t < 45 * 60; t += 0.5) {
  step(s, 0.5, rt);
  for (const ev of [...s.pendingEvents]) {
    if (seen.includes(ev.defId) && firstRepeatAt === null) firstRepeatAt = t;
    seen.push(ev.defId);
    apply(s, { type: 'resolveEvent', eventUid: ev.uid, choiceIndex: 0 });
  }
  s.rollTokens = 0; // isolate the card system
}
const uniq = new Set(seen);
console.log(`cards drawn: ${seen.length} | distinct: ${uniq.size}`);
console.log(`first repeat at: ${firstRepeatAt === null ? 'never' : (firstRepeatAt / 60).toFixed(1) + ' min'}`);
console.log(`deck exhausted (all distinct seen) after ~${(seen.length && uniq.size) ? (45 / (seen.length / uniq.size)).toFixed(1) : '?'} min of unique content`);

/**
 * Random helpers. Deliberately not seeded — this is a single-player game and
 * unpredictability is the point — but centralised so it is easy to swap in a
 * seeded PRNG later for deterministic tests.
 */

export function range(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

/** Box–Muller transform: a standard normal sample, for price random walks. */
export function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

let idCounter = 0;
export function uid(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

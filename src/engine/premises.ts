import type { CategoryId, GameState, PremisesOffer } from './types';
import { CATEGORY_BY_ID } from './content/businesses';
import { AGENT_PITCHES, TRAIT_BY_ID, traitsFor, type TraitDef } from './content/traits';
import { pick, uid } from './rng';

/**
 * The three premises on the table.
 *
 * Opening a business used to be a button with a price on it. Now it is a
 * shortlist, and the shortlist is shaped rather than random: one place that is
 * simply good and priced like it, one that is cheap because something is wrong
 * with it, and one that is interesting in both directions. Three random rolls
 * would frequently produce three near-identical sites and no decision at all.
 *
 * Offers persist in the save and only regenerate after you buy in that
 * category, so backing out and coming back cannot reroll a shortlist you did
 * not like. The asking price is stored as a multiple rather than an amount,
 * because the underlying cost ramps with net worth — a stored amount would let
 * you window-shop early and buy at last week's prices.
 */

const OFFERS_PER_CATEGORY = 3;

function priceOf(traits: TraitDef[]): number {
  return traits.reduce((mult, t) => mult * (t.price ?? 1), 1);
}

function draw(pool: TraitDef[], taken: Set<string>): TraitDef | null {
  const available = pool.filter((t) => !taken.has(t.id));
  if (available.length === 0) return null;
  const chosen = pick(available);
  taken.add(chosen.id);
  return chosen;
}

function makeOffer(
  category: CategoryId,
  name: string,
  traits: TraitDef[],
  /** Nudges the asking price so two sites with the same traits still differ. */
  haggle: number,
  /** Pitches already used on this shortlist. */
  usedPitches: Set<string>,
): PremisesOffer {
  // Drawn without replacement: three independent picks from fourteen lines
  // collide about a third of the time, and two listings selling themselves
  // with the same sentence reads as a bug rather than a joke.
  const free = AGENT_PITCHES.filter((p) => !usedPitches.has(p));
  const pitch = pick(free.length > 0 ? free : AGENT_PITCHES);
  usedPitches.add(pitch);

  return {
    id: uid('prem'),
    category,
    name,
    traits: traits.map((t) => t.id),
    priceMultiplier: priceOf(traits) * haggle,
    pitch,
  };
}

/**
 * Builds a fresh shortlist. `existingNames` keeps a listing from being offered
 * under a name you already trade under.
 */
export function generateOffers(category: CategoryId, existingNames: string[]): PremisesOffer[] {
  const def = CATEGORY_BY_ID[category];
  const pool = traitsFor(category);
  const good = pool.filter((t) => t.tone === 'good');
  const bad = pool.filter((t) => t.tone === 'bad');
  const mixed = pool.filter((t) => t.tone === 'mixed');

  // Names are drawn without replacement across the shortlist and against the
  // empire, so three listings never arrive with the same name.
  const usedNames = new Set(existingNames);
  const nextName = (index: number): string => {
    const free = def.names.filter((n) => !usedNames.has(n));
    const name = free.length > 0 ? pick(free) : `${pick(def.names)} ${usedNames.size + index + 1}`;
    usedNames.add(name);
    return name;
  };

  const taken = new Set<string>();
  const pitches = new Set<string>();
  const offers: PremisesOffer[] = [];

  // 1. The good one. Priced like it.
  const cleanTraits = [draw(good, taken)].filter((t): t is TraitDef => t !== null);
  offers.push(makeOffer(category, nextName(0), cleanTraits, 1.02, pitches));

  // 2. The bargain: something is wrong with it, and that is the whole pitch.
  const bargainTraits = [draw(bad, taken)].filter((t): t is TraitDef => t !== null);
  offers.push(makeOffer(category, nextName(1), bargainTraits, 0.97, pitches));

  // 3. The wildcard: a double-edged site, sometimes with a second trait either
  //    way, which is where the genuinely interesting purchases come from.
  const wildTraits = [draw(mixed, taken), draw(pick([good, bad]), taken)].filter(
    (t): t is TraitDef => t !== null,
  );
  offers.push(makeOffer(category, nextName(2), wildTraits, 1.0, pitches));

  return offers.slice(0, OFFERS_PER_CATEGORY);
}

/** The shortlist for a category, generating one on first look. */
export function offersFor(s: GameState, category: CategoryId): PremisesOffer[] {
  const existing = s.premises[category];
  if (existing && existing.length > 0) return existing;
  const fresh = generateOffers(
    category,
    s.businesses.map((b) => b.name),
  );
  s.premises[category] = fresh;
  return fresh;
}

// ------------------------------------------------------------- trait effects
//
// Read by the financial selectors and the simulation. Each folds the traits a
// business carries into one number, so callers never walk the list themselves.

function traitDefs(traits: string[]): TraitDef[] {
  return traits.map((id) => TRAIT_BY_ID[id]).filter((t): t is TraitDef => t !== undefined);
}

export function traitRevenueMultiplier(traits: string[]): number {
  return traitDefs(traits).reduce((mult, t) => mult * (t.revenue ?? 1), 1);
}

export function traitUpkeepDelta(traits: string[]): number {
  return traitDefs(traits).reduce((sum, t) => sum + (t.upkeep ?? 0), 0);
}

export function traitStaffCapDelta(traits: string[]): number {
  return traitDefs(traits).reduce((sum, t) => sum + (t.staffCap ?? 0), 0);
}

export function traitEventRate(traits: string[]): number {
  return traitDefs(traits).reduce((mult, t) => mult * (t.eventRate ?? 1), 1);
}

export function traitPriceMultiplier(traits: string[]): number {
  return priceOf(traitDefs(traits));
}

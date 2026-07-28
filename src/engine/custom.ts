import type {
  CategoryId,
  CustomDesign,
  EventCardDef,
  EventChoice,
  EventOutcome,
  GameState,
} from './types';
import { CATEGORIES, CATEGORY_BY_ID } from './content/businesses';
import { TRAIT_BY_ID } from './content/traits';
import { EVENT_BY_ID } from './content/events';
import { uid } from './rng';

/**
 * Player-designed businesses.
 *
 * A design is fiction wrapped around primitives the engine already knows how to
 * price. It never carries an economic number of its own: it names one of the
 * six measured archetypes, borrows trait ids from the priced list, and its
 * cards pay out on the same authored 0–600 "seconds of income" scale every
 * hand-written card uses. That is the whole reason a business can be a funeral
 * home that also does weddings without the pacing work collapsing — the
 * simulation cannot tell it apart from a restaurant, because economically it
 * *is* a restaurant with different words on it.
 *
 * Everything here treats its input as hostile. It arrives as JSON from a
 * language model, over a network, shaped by whatever the player typed into a
 * free-text box, and it goes straight into the object the whole game is
 * computed from. `validateDesign` is the only door: it rejects rather than
 * repairs anything structural, and clamps rather than trusts anything numeric.
 */

// --------------------------------------------------------------------- limits
//
// Bounds on what a design may contain. These are deliberately strict — a
// generated deck twice the size of a hand-written one would not be a bonus, it
// would swamp the draw and starve the authored cards.

export const DESIGN_LIMITS = {
  nameMax: 40,
  taglineMax: 90,
  blurbMax: 200,
  textMax: 400,
  labelMax: 48,
  hintMax: 40,
  roleMax: 32,
  minRoles: 2,
  maxRoles: 6,
  minCards: 4,
  maxCards: 16,
  minChoices: 2,
  maxChoices: 3,
  maxTraits: 2,
  /** The band hand-written cards are authored in; generated ones share it. */
  cashSecondsMax: 600,
  moraleMax: 0.15,
  luckMax: 5,
  rollsMax: 3,
  staffMax: 2,
  /** Emoji only, and one of them. */
  iconMax: 4,
} as const;

const ARCHETYPES = new Set<string>(CATEGORIES.map((c) => c.id));

export class DesignError extends Error {}

// ------------------------------------------------------------------ helpers

function str(value: unknown, max: number, field: string): string {
  if (typeof value !== 'string') throw new DesignError(`${field} must be text`);
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) throw new DesignError(`${field} is empty`);
  return trimmed.slice(0, max);
}

/**
 * Clamps a number into a band, treating anything non-finite as zero. NaN and
 * Infinity are the two values that would silently poison every downstream
 * calculation, and JSON from a model can contain neither legitimately.
 */
function clamp(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  // Non-finite falls back to zero *through the same clamp*, not past it.
  // Returning a bare 0 skipped the minimum, so a card arriving with NaN odds
  // became a choice that could never succeed rather than one at the floor.
  const safe = Number.isFinite(n) ? n : 0;
  return Math.min(max, Math.max(min, safe));
}

function optionalClamp(value: unknown, limit: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = clamp(value, -limit, limit);
  return n === 0 ? undefined : n;
}

// ------------------------------------------------------------------ outcomes

function validateOutcome(raw: unknown, where: string): EventOutcome {
  if (typeof raw !== 'object' || raw === null) throw new DesignError(`${where} is missing`);
  const o = raw as Record<string, unknown>;

  const outcome: EventOutcome = { text: str(o.text, DESIGN_LIMITS.textMax, `${where}.text`) };

  const cashSeconds = optionalClamp(o.cashSeconds, DESIGN_LIMITS.cashSecondsMax);
  if (cashSeconds !== undefined) outcome.cashSeconds = cashSeconds;

  const morale = optionalClamp(o.morale, DESIGN_LIMITS.moraleMax);
  if (morale !== undefined) outcome.morale = morale;

  const luck = optionalClamp(o.luck, DESIGN_LIMITS.luckMax);
  if (luck !== undefined) outcome.luck = luck;

  const rolls = optionalClamp(o.rolls, DESIGN_LIMITS.rollsMax);
  if (rolls !== undefined && rolls > 0) outcome.rolls = Math.round(rolls);

  const staff = optionalClamp(o.staff, DESIGN_LIMITS.staffMax);
  if (staff !== undefined) outcome.staff = Math.round(staff);

  // Deliberately not supported from a design: `cash` (a flat amount would not
  // scale with the empire and is trivially unbalanced), `boost` (compounds into
  // ticker income and is the strongest thing in the game), `addTrait` /
  // `removeTrait` (permanent), and `chain` (would let a design queue a card
  // that does not exist). Tags are allowed but namespaced below.
  if (typeof o.addTag === 'object' && o.addTag !== null) {
    const tag = o.addTag as Record<string, unknown>;
    if (typeof tag.tag === 'string' && tag.tag.trim()) {
      // Namespaced so a design can never satisfy or block a hand-written card's
      // requiresTag, which would let generated content reach into the authored
      // deck and pull cards it was never meant to see.
      outcome.addTag = {
        tag: `custom:${tag.tag.trim().slice(0, 32)}`,
        seconds: clamp(tag.seconds ?? 600, 60, 1800),
      };
    }
  }
  if (typeof o.removeTag === 'string' && o.removeTag.trim()) {
    outcome.removeTag = `custom:${o.removeTag.trim().slice(0, 32)}`;
  }

  return outcome;
}

function validateChoice(raw: unknown, where: string): EventChoice {
  if (typeof raw !== 'object' || raw === null) throw new DesignError(`${where} is missing`);
  const c = raw as Record<string, unknown>;

  return {
    label: str(c.label, DESIGN_LIMITS.labelMax, `${where}.label`),
    hint: str(c.hint, DESIGN_LIMITS.hintMax, `${where}.hint`),
    // A choice that always succeeds is legitimate — it is how "pay to make it
    // go away" is written — but one that never can is not a choice at all.
    odds: clamp(c.odds, 0.15, 1),
    good: validateOutcome(c.good, `${where}.good`),
    bad: validateOutcome(c.bad, `${where}.bad`),
  };
}

function validateCard(raw: unknown, index: number, designId: string, archetype: CategoryId): EventCardDef {
  if (typeof raw !== 'object' || raw === null) throw new DesignError(`card ${index} is missing`);
  const c = raw as Record<string, unknown>;
  const where = `card ${index}`;

  if (!Array.isArray(c.choices)) throw new DesignError(`${where} has no choices`);
  if (c.choices.length < DESIGN_LIMITS.minChoices) {
    throw new DesignError(`${where} needs at least ${DESIGN_LIMITS.minChoices} choices`);
  }

  const choices = c.choices
    .slice(0, DESIGN_LIMITS.maxChoices)
    .map((ch, i) => validateChoice(ch, `${where}.choice ${i}`));

  return {
    // Card ids are namespaced by design so two designs, or a design and the
    // authored deck, can never collide in EVENT_BY_ID.
    id: `custom_${designId}_${index}`,
    category: archetype,
    title: str(c.title, DESIGN_LIMITS.labelMax, `${where}.title`),
    body: str(c.body, DESIGN_LIMITS.textMax, `${where}.body`),
    choices,
  };
}

// -------------------------------------------------------------------- design

/**
 * The only way a design enters the game. Throws rather than repairs on
 * anything structural — a design missing its archetype is not a design — and
 * clamps silently on anything numeric, because a model returning 50,000
 * cashSeconds is not malice, it is a plausible misreading of the scale.
 */
export function validateDesign(raw: unknown, existing?: Partial<CustomDesign>): CustomDesign {
  if (typeof raw !== 'object' || raw === null) throw new DesignError('no design returned');
  const d = raw as Record<string, unknown>;

  const archetype = typeof d.archetype === 'string' ? d.archetype.trim() : '';
  if (!ARCHETYPES.has(archetype)) {
    throw new DesignError(
      `archetype must be one of ${[...ARCHETYPES].join(', ')} — got "${archetype}"`,
    );
  }

  // Unknown trait ids are dropped rather than rejected: the rest of the design
  // is still perfectly good, and a model reaching for a trait that sounds right
  // but does not exist is the most likely single mistake it will make.
  const traits = Array.isArray(d.traits)
    ? d.traits
        .filter((t): t is string => typeof t === 'string' && TRAIT_BY_ID[t] !== undefined)
        .slice(0, DESIGN_LIMITS.maxTraits)
    : [];

  const roles = Array.isArray(d.staffRoles)
    ? d.staffRoles
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .map((r) => r.trim().slice(0, DESIGN_LIMITS.roleMax))
        .slice(0, DESIGN_LIMITS.maxRoles)
    : [];
  if (roles.length < DESIGN_LIMITS.minRoles) {
    throw new DesignError(`needs at least ${DESIGN_LIMITS.minRoles} staff roles`);
  }

  if (!Array.isArray(d.cards) || d.cards.length < DESIGN_LIMITS.minCards) {
    throw new DesignError(`needs at least ${DESIGN_LIMITS.minCards} event cards`);
  }

  const id = existing?.id ?? uid('design');
  const cards = d.cards
    .slice(0, DESIGN_LIMITS.maxCards)
    .map((c, i) => validateCard(c, i, id, archetype as CategoryId));

  return {
    id,
    name: str(d.name, DESIGN_LIMITS.nameMax, 'name'),
    tagline: str(d.tagline, DESIGN_LIMITS.taglineMax, 'tagline'),
    blurb: str(d.blurb, DESIGN_LIMITS.blurbMax, 'blurb'),
    archetype: archetype as CategoryId,
    traits,
    staffRoles: roles,
    icon: typeof d.icon === 'string' && d.icon.trim() ? d.icon.trim().slice(0, DESIGN_LIMITS.iconMax) : '🏢',
    cards,
    // Provenance and history. Preserved across a refine, and across a prestige,
    // because the point of the catalogue is that a design remembers.
    prompt: existing?.prompt ?? '',
    createdAt: existing?.createdAt ?? Date.now(),
    runsOpened: existing?.runsOpened ?? 0,
    bestNetWorth: existing?.bestNetWorth ?? 0,
    timesOpened: existing?.timesOpened ?? 0,
  };
}

// ------------------------------------------------------------------ catalogue

export function designById(s: GameState, id: string | null): CustomDesign | undefined {
  if (!id) return undefined;
  return s.designs.find((d) => d.id === id);
}

/** Every card a business can draw from its design, if it has one. */
export function designCards(s: GameState, designId: string | null): EventCardDef[] {
  return designById(s, designId)?.cards ?? [];
}

/**
 * The category a business is economically, which for a design is its archetype.
 * Every financial selector goes through the business's own `category` field, so
 * this exists for the UI and for anything that needs the design's presentation
 * rather than its economics.
 */
export function displayFor(
  s: GameState,
  business: { category: CategoryId; designId?: string | null },
): { name: string; icon: string; accent: string; plural: string } {
  const design = designById(s, business.designId ?? null);
  const def = CATEGORY_BY_ID[business.category];
  if (!design) return { name: def.name, icon: def.icon, accent: def.accent, plural: def.plural };
  return { name: design.tagline, icon: design.icon, accent: def.accent, plural: design.name };
}

/**
 * Card lookup that also sees generated decks.
 *
 * Every hand-written card lives in EVENT_BY_ID, built once at module load. A
 * design's cards cannot: they are created at runtime and live in the save. Any
 * code that resolves a card id therefore has to come through here, or a custom
 * card would queue fine and then vanish when the player tried to play it.
 */
export function cardById(s: GameState, defId: string): EventCardDef | undefined {
  const authored = EVENT_BY_ID[defId];
  if (authored) return authored;
  if (!defId.startsWith('custom_')) return undefined;
  for (const design of s.designs) {
    const found = design.cards.find((c) => c.id === defId);
    if (found) return found;
  }
  return undefined;
}

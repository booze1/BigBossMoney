import type { CategoryId } from '../types';

/**
 * Premises traits.
 *
 * A business used to be a row of numbers that differed from its neighbour only
 * by category and level. Traits are what make your fifth corner shop a
 * different proposition from your first: they move the money, change how often
 * the place surfaces a decision, and gate which cards it can draw at all.
 *
 * Every `price` here is measured, not chosen — `npx tsx tools/traits.ts` prints
 * the value each trait should carry, derived from what it actually does to
 * earnings. Change an effect and re-run it; do not hand-edit a price.
 *
 * They are also the reason buying is now a choice rather than a button. Every
 * premises on offer carries its traits openly and prices itself accordingly —
 * `price` is the asking multiplier, and it is what keeps a flaw from being a
 * free discount or an advantage from being a free upgrade.
 *
 * `curable: true` marks a flaw an event can clear. Anything a site is sold with
 * should be curable; the player needs a road out of a bad purchase that is not
 * just selling it.
 */
export interface TraitDef {
  id: string;
  name: string;
  /** One line, shown under the name wherever the trait appears. */
  blurb: string;
  tone: 'good' | 'bad' | 'mixed';
  /** Categories this can appear on. Omitted means any. */
  categories?: CategoryId[];
  /** Multiplier on gross revenue. */
  revenue?: number;
  /** Additive change to the category's upkeep ratio. */
  upkeep?: number;
  /** Additive change to the staff cap. */
  staffCap?: number;
  /**
   * Multiplier on the gap between event cards — how alive the location is.
   * Below 1 is a busy site where things keep happening; above 1 is a place
   * where they do not. It reads as a downside for a neglected premises and an
   * upside for a thronged one, and it is measurably worth money in that
   * direction, because playing cards is how you earn beyond the ticker.
   */
  eventRate?: number;
  /** Multiplier on the asking price of a premises carrying this. */
  price?: number;
  /** Whether an event can clear this. Everything sold as a flaw should be. */
  curable?: boolean;
}

export const TRAITS: TraitDef[] = [
  // ------------------------------------------------------------- any category
  {
    id: 'corner_lot',
    name: 'Corner lot',
    blurb: 'Two frontages. People find it without being told.',
    tone: 'good',
    revenue: 1.08,
    price: 1.03,
  },
  {
    id: 'high_footfall',
    name: 'High footfall',
    blurb: 'Thousands pass the door. Thousands of them touch things.',
    tone: 'mixed',
    revenue: 1.14,
    upkeep: 0.02,
    eventRate: 0.92,
    price: 1.12,
  },
  {
    id: 'by_the_station',
    name: 'By the station',
    blurb: 'The commute walks past twice a day.',
    tone: 'good',
    revenue: 1.1,
    eventRate: 0.93,
    price: 1.12,
  },
  {
    id: 'backstreet',
    name: 'Backstreet',
    blurb: 'You will have to give people a reason to come.',
    tone: 'bad',
    revenue: 0.9,
    price: 0.97,
  },
  {
    id: 'quiet_street',
    name: 'Quiet street',
    blurb: 'Less trade, but nothing much happens here either.',
    tone: 'mixed',
    revenue: 0.92,
    eventRate: 1.15,
    price: 0.84,
  },
  {
    id: 'damp',
    name: 'Damp',
    blurb: 'Behind the plaster. The survey was optimistic.',
    tone: 'bad',
    upkeep: 0.05,
    price: 0.95,
    curable: true,
  },
  {
    id: 'vermin',
    name: 'Vermin',
    blurb: 'The previous tenant left, and something stayed.',
    tone: 'bad',
    revenue: 0.94,
    eventRate: 1.1,
    price: 0.89,
    curable: true,
  },
  {
    id: 'flood_risk',
    name: 'Flood risk',
    blurb: 'Insurable, at a price, on a river that has opinions.',
    tone: 'bad',
    upkeep: 0.06,
    price: 0.94,
    curable: true,
  },
  {
    id: 'listed_building',
    name: 'Listed building',
    blurb: 'Beautiful. You may not change a single window.',
    tone: 'mixed',
    revenue: 1.07,
    upkeep: 0.04,
    price: 0.98,
  },
  {
    id: 'good_bones',
    name: 'Good bones',
    blurb: 'Someone built this properly, a long time ago.',
    tone: 'good',
    upkeep: -0.04,
    price: 1.04,
  },
  {
    id: 'fresh_fit_out',
    name: 'Fresh fit-out',
    blurb: 'The last owner spent the money and then ran out of it.',
    tone: 'good',
    upkeep: -0.03,
    revenue: 1.04,
    price: 1.05,
  },
  {
    id: 'tourist_trap',
    name: 'Tourist trap',
    blurb: 'Nobody comes twice, and nobody needs to.',
    tone: 'mixed',
    revenue: 1.2,
    upkeep: 0.03,
    eventRate: 0.9,
    price: 1.15,
  },
  {
    id: 'student_quarter',
    name: 'Student quarter',
    blurb: 'Cheap labour, thin wallets, unpredictable nights.',
    tone: 'mixed',
    revenue: 1.09,
    staffCap: 2,
    upkeep: 0.02,
    eventRate: 0.93,
    price: 1.09,
  },
  {
    id: 'bad_landlord',
    name: 'Bad landlord',
    blurb: 'Reachable only when the rent is late.',
    tone: 'bad',
    upkeep: 0.04,
    eventRate: 1.08,
    price: 0.88,
    curable: true,
  },

  // -------------------------------------------------------------------- retail
  {
    id: 'loyal_regulars',
    name: 'Loyal regulars',
    blurb: 'They came for the last owner. They might stay.',
    tone: 'good',
    categories: ['retail'],
    revenue: 1.1,
    price: 1.03,
  },
  {
    id: 'shoplifted',
    name: 'Known to shoplifters',
    blurb: 'It is on a list, and the list gets around.',
    tone: 'bad',
    categories: ['retail'],
    revenue: 0.95,
    eventRate: 1.1,
    price: 0.89,
    curable: true,
  },
  {
    id: 'big_windows',
    name: 'Big windows',
    blurb: 'The whole street can see what you are selling.',
    tone: 'mixed',
    categories: ['retail'],
    revenue: 1.08,
    upkeep: 0.02,
    price: 1.0,
  },

  // ---------------------------------------------------------------- restaurant
  {
    id: 'chefs_kitchen',
    name: "Chef's kitchen",
    blurb: 'Extraction, gas, and a pass you could run a service from tonight.',
    tone: 'good',
    categories: ['restaurant'],
    revenue: 1.13,
    price: 1.04,
  },
  {
    id: 'tiny_kitchen',
    name: 'Tiny kitchen',
    blurb: 'Two people in it is a crowd. Three is an argument.',
    tone: 'bad',
    categories: ['restaurant'],
    revenue: 0.94,
    staffCap: -2,
    price: 0.98,
  },
  {
    id: 'street_terrace',
    name: 'Street terrace',
    blurb: 'Twelve covers outside, weather permitting, licence pending.',
    tone: 'good',
    categories: ['restaurant'],
    revenue: 1.11,
    upkeep: 0.02,
    price: 1.01,
  },

  // ----------------------------------------------------------------- nightclub
  {
    id: 'serious_sound',
    name: 'Serious sound system',
    blurb: 'Rigged by someone who cared. Worth more than the lease.',
    tone: 'good',
    categories: ['nightclub'],
    revenue: 1.15,
    price: 1.05,
  },
  {
    id: 'noise_complaints',
    name: 'Noise complaints on file',
    blurb: 'The flat above has a spreadsheet and a councillor.',
    tone: 'bad',
    categories: ['nightclub'],
    eventRate: 1.12,
    upkeep: 0.04,
    price: 0.85,
    curable: true,
  },
  {
    id: 'late_licence',
    name: 'Late licence',
    blurb: 'Until four. The last two hours are the profitable ones.',
    tone: 'good',
    categories: ['nightclub'],
    revenue: 1.13,
    price: 1.04,
  },

  // ---------------------------------------------------------------------- tech
  {
    id: 'pedigree_founders',
    name: 'Pedigree founders',
    blurb: 'Two ex-big-tech, one idea, and a deck with no numbers in it.',
    tone: 'good',
    categories: ['tech'],
    revenue: 1.13,
    price: 1.04,
  },
  {
    id: 'built_on_a_weekend',
    name: 'Built on a weekend',
    blurb: 'It works. Nobody living knows why.',
    tone: 'bad',
    categories: ['tech'],
    upkeep: 0.05,
    eventRate: 1.12,
    price: 0.83,
    curable: true,
  },
  {
    id: 'open_source_darling',
    name: 'Open-source darling',
    blurb: 'Beloved by people who will never pay for it.',
    tone: 'mixed',
    categories: ['tech'],
    revenue: 1.09,
    upkeep: 0.03,
    price: 0.99,
  },

  // ---------------------------------------------------------------------- bank
  {
    id: 'old_money',
    name: 'Old money on the books',
    blurb: 'Quiet accounts that have been there for three generations.',
    tone: 'good',
    categories: ['bank'],
    revenue: 1.12,
    price: 1.04,
  },
  {
    id: 'regulator_watch',
    name: "On the regulator's list",
    blurb: 'Inherited, not earned, and no easier to get off for that.',
    tone: 'bad',
    categories: ['bank'],
    upkeep: 0.05,
    eventRate: 1.12,
    price: 0.83,
    curable: true,
  },
  {
    id: 'branch_network',
    name: 'Branch network',
    blurb: 'Small, expensive, and the reason anyone trusts you.',
    tone: 'mixed',
    categories: ['bank'],
    revenue: 1.06,
    staffCap: 3,
    upkeep: 0.02,
    price: 1.0,
  },

  // --------------------------------------------------------------------- devco
  {
    id: 'planning_ties',
    name: 'Friends at planning',
    blurb: 'Nothing improper. Just a returned phone call.',
    tone: 'good',
    categories: ['devco'],
    revenue: 1.11,
    price: 1.04,
  },
  {
    id: 'contested_title',
    name: 'Contested title',
    blurb: 'A cousin in another country believes this is theirs.',
    tone: 'bad',
    categories: ['devco'],
    revenue: 0.95,
    upkeep: 0.04,
    price: 0.94,
    curable: true,
  },
  {
    id: 'owns_its_plant',
    name: 'Owns its plant',
    blurb: 'Cranes, diggers, a yard. Nothing hired by the week.',
    tone: 'good',
    categories: ['devco'],
    upkeep: -0.05,
    price: 1.05,
  },
];

export const TRAIT_BY_ID: Record<string, TraitDef> = Object.fromEntries(
  TRAITS.map((t) => [t.id, t]),
);

/** Traits that can appear on a premises in this category. */
export function traitsFor(category: CategoryId): TraitDef[] {
  return TRAITS.filter((t) => !t.categories || t.categories.includes(category));
}

/** Flaws an event is allowed to clear, for the "fix the place up" cards. */
export const CURABLE_TRAITS = TRAITS.filter((t) => t.curable).map((t) => t.id);

/**
 * Agent-speak. One of these goes on every listing, chosen at random and
 * independent of the traits, because the pitch is never about the traits.
 */
export const AGENT_PITCHES: string[] = [
  'The agent describes it as "characterful".',
  'Vacant since the last owner stopped returning calls.',
  'Priced to move. Move being the operative word.',
  'The agent will not be drawn on why it is empty.',
  '"A rare opportunity," according to the person selling it.',
  'Three viewings this week. None of them came back.',
  'The vendor is motivated, which is never a good sign for the vendor.',
  'Photographed on the one sunny day of the year.',
  'The floor plan is best described as optimistic.',
  'Previous tenant left in a hurry and left the fittings.',
  'The agent keeps saying "footfall" and looking at the door.',
  'Sold twice in two years. Nobody will say why.',
  'Comes with the keys and a folder nobody has opened.',
  'The lease is long, which the agent mentions first and often.',
];

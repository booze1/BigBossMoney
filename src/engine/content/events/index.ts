import type { EventCardDef } from '../../types';
import { RETAIL_CARDS } from './retail';
import { RESTAURANT_CARDS } from './restaurant';
import { NIGHTCLUB_CARDS } from './nightclub';
import { TECH_CARDS } from './tech';
import { BANK_CARDS } from './bank';
import { DEVCO_CARDS } from './devco';
import { GENERAL_CARDS } from './general';
import { PREMISES_CARDS } from './premises';

/**
 * The full event deck, assembled from one file per category.
 *
 * Cards are drawn without replacement per business (see `pickCardFor`), so
 * adding cards to a category directly extends how long that business goes
 * before repeating itself.
 */

export const EVENT_CARDS: EventCardDef[] = [
  ...RETAIL_CARDS,
  ...RESTAURANT_CARDS,
  ...NIGHTCLUB_CARDS,
  ...TECH_CARDS,
  ...BANK_CARDS,
  ...DEVCO_CARDS,
  ...GENERAL_CARDS,
  ...PREMISES_CARDS,
];

export const EVENTS_BY_CATEGORY = EVENT_CARDS.reduce<Record<string, EventCardDef[]>>((acc, card) => {
  (acc[card.category] ??= []).push(card);
  return acc;
}, {});

export const EVENT_BY_ID: Record<string, EventCardDef> = Object.fromEntries(
  EVENT_CARDS.map((c) => [c.id, c]),
);

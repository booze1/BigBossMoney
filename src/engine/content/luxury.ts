import type { LuxuryItem } from '../types';

/**
 * Luxury goods are not a money sink — they buy Flex, and Flex is a real stat:
 *  - raises Luck (better roll odds)
 *  - multiplies empire-wide income
 *  - discounts loan interest
 *  - gates the top manager tiers and the most exclusive property markets
 *
 * Items also revalue over time. Cars and jets bleed value; watches and estates
 * appreciate. Buying well is its own small investment game.
 */

export const LUXURY_ITEMS: LuxuryItem[] = [
  // ------------------------------------------------------------------ cars
  { id: 'car_hatch', name: 'Hot Hatch GTI', brand: 'Volkswerk', category: 'car', price: 42_000, flex: 2, appreciation: -0.14, unlockAt: 0 },
  { id: 'car_coupe', name: 'M-Sport Coupé', brand: 'Bayern Motors', category: 'car', price: 96_000, flex: 5, appreciation: -0.12, unlockAt: 60_000 },
  { id: 'car_gt', name: 'Grand Tourer', brand: 'Aston Marlin', category: 'car', price: 285_000, flex: 12, appreciation: -0.08, unlockAt: 300_000 },
  { id: 'car_super', name: 'Huracana Performante', brand: 'Lamborgotti', category: 'car', price: 620_000, flex: 26, appreciation: -0.04, unlockAt: 900_000 },
  { id: 'car_hyper', name: 'Chironne Sport', brand: 'Bugatta', category: 'car', price: 3_400_000, flex: 78, appreciation: 0.02, unlockAt: 6_000_000 },
  { id: 'car_oneoff', name: 'La Rossa One-Off', brand: 'Ferrini', category: 'car', price: 14_500_000, flex: 190, appreciation: 0.09, unlockAt: 40_000_000 },

  // ---------------------------------------------------------------- watches
  { id: 'watch_diver', name: 'Seamariner 300', brand: 'Omegon', category: 'watch', price: 8_500, flex: 1, appreciation: -0.02, unlockAt: 0 },
  { id: 'watch_steel', name: 'Datemaster Steel', brand: 'Rollex', category: 'watch', price: 24_000, flex: 4, appreciation: 0.05, unlockAt: 40_000 },
  { id: 'watch_nautilus', name: 'Nautical 5711', brand: 'Patrique Philipp', category: 'watch', price: 165_000, flex: 14, appreciation: 0.11, unlockAt: 400_000 },
  { id: 'watch_royal', name: 'Royal Oaken Skeleton', brand: 'Audemar Pigeot', category: 'watch', price: 480_000, flex: 32, appreciation: 0.09, unlockAt: 1_500_000 },
  { id: 'watch_grande', name: 'Grande Complication', brand: 'Vachiron', category: 'watch', price: 2_600_000, flex: 88, appreciation: 0.12, unlockAt: 15_000_000 },

  // ------------------------------------------------------------------ jets
  { id: 'jet_share', name: 'Fractional Jet Share', brand: 'NetJet Partners', category: 'jet', price: 750_000, flex: 18, appreciation: -0.18, unlockAt: 1_200_000 },
  { id: 'jet_light', name: 'Phenomenon 300E', brand: 'Embracer', category: 'jet', price: 9_800_000, flex: 62, appreciation: -0.09, unlockAt: 14_000_000 },
  { id: 'jet_mid', name: 'Challengr 3500', brand: 'Bombardo', category: 'jet', price: 27_000_000, flex: 130, appreciation: -0.07, unlockAt: 45_000_000 },
  { id: 'jet_global', name: 'Global 8000', brand: 'Bombardo', category: 'jet', price: 78_000_000, flex: 280, appreciation: -0.05, unlockAt: 150_000_000 },
  { id: 'jet_bbj', name: 'Private Airliner', brand: 'Boing Business Jets', category: 'jet', price: 340_000_000, flex: 720, appreciation: -0.04, unlockAt: 700_000_000 },

  // ---------------------------------------------------------------- yachts
  { id: 'yacht_sport', name: 'Sport Yacht 52', brand: 'Sunseekr', category: 'yacht', price: 2_100_000, flex: 24, appreciation: -0.11, unlockAt: 3_500_000 },
  { id: 'yacht_fly', name: 'Flybridge 88', brand: 'Ferretty', category: 'yacht', price: 12_000_000, flex: 74, appreciation: -0.08, unlockAt: 20_000_000 },
  { id: 'yacht_super', name: 'Superyacht "Liquidity"', brand: 'Feadsheep', category: 'yacht', price: 96_000_000, flex: 320, appreciation: -0.05, unlockAt: 180_000_000 },
  { id: 'yacht_giga', name: 'Gigayacht "Terminal Value"', brand: 'Lürsson', category: 'yacht', price: 480_000_000, flex: 950, appreciation: -0.03, unlockAt: 1_000_000_000 },

  // --------------------------------------------------------------- estates
  { id: 'est_condo', name: 'Skyline Condo', brand: 'Downtown', category: 'estate', price: 1_400_000, flex: 16, appreciation: 0.07, unlockAt: 2_000_000 },
  { id: 'est_beach', name: 'Beachfront Villa', brand: 'Malibeu', category: 'estate', price: 18_000_000, flex: 96, appreciation: 0.08, unlockAt: 30_000_000 },
  { id: 'est_ranch', name: 'Mountain Ranch', brand: 'Aspand', category: 'estate', price: 46_000_000, flex: 175, appreciation: 0.06, unlockAt: 90_000_000 },
  { id: 'est_chateau', name: 'Loire Château', brand: 'Historic', category: 'estate', price: 130_000_000, flex: 420, appreciation: 0.05, unlockAt: 400_000_000 },
  { id: 'est_island', name: 'Private Island', brand: 'Undisclosed', category: 'estate', price: 620_000_000, flex: 1_400, appreciation: 0.06, unlockAt: 1_500_000_000 },
];

export const LUXURY_BY_ID: Record<string, LuxuryItem> = Object.fromEntries(
  LUXURY_ITEMS.map((i) => [i.id, i]),
);

export const LUXURY_CATEGORIES = [
  { id: 'car', label: 'Cars', icon: '🏎️' },
  { id: 'watch', label: 'Watches', icon: '⌚' },
  { id: 'jet', label: 'Jets', icon: '✈️' },
  { id: 'yacht', label: 'Yachts', icon: '🛥️' },
  { id: 'estate', label: 'Estates', icon: '🏝️' },
] as const;

/** Flex milestones, shown as a progress ladder on the Flex screen. */
export const FLEX_MILESTONES = [
  { at: 40, label: 'Executives available', detail: 'You can hire Executive-tier managers.' },
  { at: 120, label: 'Preferred lending', detail: 'Noticeably cheaper interest on borrowing.' },
  { at: 220, label: 'Legendary Operators', detail: 'The very best managers will take your call.' },
  { at: 400, label: 'Deal flow', detail: 'Luck rolls skew meaningfully rarer.' },
  { at: 800, label: 'Untouchable', detail: 'Empire-wide income multiplier becomes significant.' },
];

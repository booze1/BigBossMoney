import type { CategoryId, ManagerTier } from '../types';
import { TUNING } from './tuning';

export interface CategoryDef {
  id: CategoryId;
  name: string;
  /** Plural, for headers. */
  plural: string;
  icon: string;
  blurb: string;
  /** Cost of the first business in this category. */
  baseCost: number;
  /** Gross revenue per second at level 1 with zero staff. */
  baseRevenue: number;
  /** Fixed operating costs as a fraction of gross revenue. */
  upkeepRatio: number;
  /** Net worth required before the category appears in the market. */
  unlockAt: number;
  /** Multiplies the size of event-card swings. */
  volatility: number;
  /** Names cycled through when founding new businesses. */
  names: string[];
  accent: string;
}

const RAW_CATEGORIES: CategoryDef[] = [
  {
    id: 'retail',
    name: 'Retail Store',
    plural: 'Retail',
    icon: '🏪',
    blurb: 'Thin margins, steady footfall, endless restocking. The honest grind.',
    baseCost: 5_000,
    baseRevenue: 74,
    upkeepRatio: 0.545,
    unlockAt: 0,
    volatility: 0.7,
    accent: '#3DDC91',
    names: [
      'Corner Store',
      'Vendly Market',
      'The Daily Stock',
      'Shelf Life',
      'Basket Case',
      'Nine Aisles',
      'Pocket Change Goods',
      'Restock & Co.',
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    plural: 'Restaurants',
    icon: '🍽️',
    blurb: 'High ceiling, high drama. One review can make or break the quarter.',
    baseCost: 35_000,
    baseRevenue: 540,
    upkeepRatio: 0.5625,
    unlockAt: 25_000,
    volatility: 1.25,
    accent: '#F5A623',
    names: [
      'Salt & Signal',
      'The Copper Pan',
      'Fork Yeah',
      'Ember Room',
      'Provisions No. 4',
      'The Quiet Table',
      'Smoke & Citrus',
      'Bistro Verdad',
    ],
  },
  {
    id: 'nightclub',
    name: 'Nightclub',
    plural: 'Nightclubs',
    icon: '🪩',
    blurb: 'Dead until midnight, printing money by 2am. Bottle service is the business.',
    baseCost: 280_000,
    baseRevenue: 4_320,
    upkeepRatio: 0.5625,
    unlockAt: 250_000,
    volatility: 1.5,
    accent: '#A16BF5',
    names: [
      'Velvet Index',
      'Afterhours',
      'The Vault Room',
      'Neon Ledger',
      'Static',
      'Room 4AM',
      'Gold Standard',
      'Basement Blue',
    ],
  },
  {
    id: 'tech',
    name: 'Tech Startup',
    plural: 'Startups',
    icon: '🚀',
    blurb: 'Burn cash, chase a hockey stick. Boom or bust, rarely in between.',
    baseCost: 2_200_000,
    baseRevenue: 33_750,
    upkeepRatio: 0.56,
    unlockAt: 2_000_000,
    volatility: 1.9,
    accent: '#38A3F5',
    names: [
      'Frictionless',
      'Nudge Labs',
      'Parseform',
      'Loop & Ledger',
      'Quantly',
      'Dovetail Systems',
      'Zeronaut',
      'Hindsight AI',
    ],
  },
  {
    id: 'bank',
    name: 'Bank',
    plural: 'Banks',
    icon: '🏛️',
    blurb: 'Capital intensive, regulated to death, and profitable beyond reason.',
    baseCost: 11_000_000,
    baseRevenue: 168_750,
    upkeepRatio: 0.56,
    unlockAt: 10_000_000,
    volatility: 1.1,
    accent: '#7DD3FC',
    names: [
      'First Meridian',
      'Halcyon Trust',
      'Northgate Financial',
      'Sterling & Vaughn',
      'Cornerstone Union',
      'Blackpine Bank',
      'Ironvale Savings',
      'The Ledger Bank',
    ],
  },
  {
    id: 'devco',
    name: 'Development Co.',
    plural: 'Development',
    icon: '🏗️',
    blurb: 'Slow, enormous, and unstoppable once the cranes are up.',
    baseCost: 45_000_000,
    baseRevenue: 675_000,
    upkeepRatio: 0.55,
    unlockAt: 40_000_000,
    volatility: 1.35,
    accent: '#FB923C',
    names: [
      'Meridian Development',
      'Skyline Holdings',
      'Groundbreak Group',
      'Atlas Property Partners',
      'Keystone Build',
      'Highwater Estates',
      'Vertex Developments',
      'Foundation & Co.',
    ],
  },
];

/**
 * Base revenues are authored at a readable scale and then run through the
 * global pacing dial, so retuning the whole economy is a one-number change.
 */
export const CATEGORIES: CategoryDef[] = RAW_CATEGORIES.map((c) => ({
  ...c,
  baseRevenue: c.baseRevenue * TUNING.baseIncomeScale,
}));

export const CATEGORY_BY_ID: Record<CategoryId, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryDef>;

export interface ManagerDef {
  tier: ManagerTier;
  name: string;
  /** Fraction of a hand-played event outcome an auto-resolve delivers. */
  efficiency: number;
  /** Salary per second as a fraction of the business's base revenue. */
  salaryRatio: number;
  /** Flat revenue multiplier the manager contributes. */
  revenueBonus: number;
  /** Hiring cost as a multiple of the business's current value. */
  hireCostRatio: number;
  /** Flex score required to hire. */
  flexRequired: number;
  blurb: string;
}

export const MANAGERS: ManagerDef[] = [
  {
    tier: 'none',
    name: 'Owner-operated',
    efficiency: 0,
    salaryRatio: 0,
    revenueBonus: 1,
    hireCostRatio: 0,
    flexRequired: 0,
    blurb: 'You handle every decision personally. Full payoff, full attention.',
  },
  {
    tier: 'junior',
    name: 'Junior Manager',
    efficiency: 0.45,
    salaryRatio: 0.05,
    revenueBonus: 1,
    hireCostRatio: 0.35,
    flexRequired: 0,
    blurb: 'Handles the easy calls. Panics on the hard ones.',
  },
  {
    tier: 'senior',
    name: 'Senior Manager',
    efficiency: 0.65,
    salaryRatio: 0.09,
    revenueBonus: 1.04,
    hireCostRatio: 0.9,
    flexRequired: 0,
    blurb: 'Been through a downturn. It shows.',
  },
  {
    tier: 'exec',
    name: 'Executive',
    efficiency: 0.8,
    salaryRatio: 0.15,
    revenueBonus: 1.1,
    hireCostRatio: 2.2,
    flexRequired: 40,
    blurb: 'Runs the place better than you do. Charges accordingly.',
  },
  {
    tier: 'legend',
    name: 'Legendary Operator',
    efficiency: 0.95,
    salaryRatio: 0.24,
    revenueBonus: 1.22,
    hireCostRatio: 5.5,
    flexRequired: 220,
    blurb: 'Poached from a competitor at enormous expense. Worth every cent.',
  },
];

export const MANAGER_BY_TIER: Record<ManagerTier, ManagerDef> = Object.fromEntries(
  MANAGERS.map((m) => [m.tier, m]),
) as Record<ManagerTier, ManagerDef>;

export const MANAGER_ORDER: ManagerTier[] = ['none', 'junior', 'senior', 'exec', 'legend'];

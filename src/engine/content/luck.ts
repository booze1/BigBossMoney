import type { Rarity } from '../types';

/**
 * The roll table. Every entry is weighted within its rarity band; the band
 * itself is chosen by `rollRarity()` in luck.ts, which is where the Luck stat
 * actually bites.
 *
 * `cashNetWorth` pays a fraction of current net worth so rewards stay relevant
 * from the first roll to the last.
 */

export interface RollReward {
  id: string;
  label: string;
  flavor: string;
  weight: number;
  /** Timed income multiplier. */
  income?: { power: number; duration: number };
  /** Permanent luck increase. */
  luck?: number;
  /** Flat cash. */
  cash?: number;
  /** Cash as a fraction of net worth. */
  cashNetWorth?: number;
  /** Extra roll tokens. */
  rolls?: number;
  /** Timed multiplier on market gains. */
  market?: { power: number; duration: number };
  /** Permanent flex. */
  flex?: number;
  /** Extends offline earning cap, in hours. */
  offlineHours?: number;
}

export const ROLL_TABLE: Record<Rarity, RollReward[]> = {
  common: [
    { id: 'c_petty', label: 'Petty Cash', flavor: 'Found in a coat pocket. Every cent counts.', weight: 30, cashNetWorth: 0.004, cash: 200 },
    { id: 'c_coupon', label: 'Supplier Discount', flavor: 'A modest bump across the empire for a few minutes.', weight: 25, income: { power: 1.15, duration: 180 } },
    { id: 'c_tip', label: 'Decent Advice', flavor: 'Someone tells you something mildly useful.', weight: 20, luck: 1 },
    { id: 'c_hour', label: 'Productive Hour', flavor: 'A small, honest gain.', weight: 25, cashNetWorth: 0.006, cash: 300 },
  ],
  uncommon: [
    { id: 'u_bonus', label: 'Quarterly Bonus', flavor: 'The numbers came in ahead. Take the cheque.', weight: 28, cashNetWorth: 0.02, cash: 1_000 },
    { id: 'u_efficiency', label: 'Efficiency Drive', flavor: 'Everything runs 35% hotter for five minutes.', weight: 26, income: { power: 1.35, duration: 300 } },
    { id: 'u_network', label: 'Good Introduction', flavor: 'The right person now knows your name.', weight: 20, luck: 4 },
    { id: 'u_token', label: 'Extra Deal Flow', flavor: 'Two more opportunities land on your desk.', weight: 14, rolls: 2 },
    { id: 'u_flex', label: 'Invitation List', flavor: 'You are on the list now. A little status goes a long way.', weight: 12, flex: 6 },
  ],
  rare: [
    { id: 'r_windfall', label: 'Windfall', flavor: 'An old position pays out unexpectedly.', weight: 26, cashNetWorth: 0.06, cash: 3_000 },
    { id: 'r_surge', label: 'Revenue Surge', flavor: 'Double income, empire-wide, for four minutes.', weight: 24, income: { power: 2.0, duration: 240 } },
    { id: 'r_reputation', label: 'Reputation Boost', flavor: 'People start assuming you know what you are doing.', weight: 18, luck: 10, flex: 10 },
    { id: 'r_market', label: 'Market Read', flavor: 'Your trades run 50% richer for six minutes.', weight: 16, market: { power: 1.5, duration: 360 } },
    { id: 'r_offline', label: 'Autopilot Systems', flavor: 'Your empire keeps earning an extra hour while you are away. Permanently.', weight: 16, offlineHours: 1 },
  ],
  epic: [
    { id: 'e_jackpot', label: 'Jackpot', flavor: 'A sum large enough to change the quarter.', weight: 28, cashNetWorth: 0.16, cash: 8_000 },
    { id: 'e_overdrive', label: 'Overdrive', flavor: 'Triple income across every business for five minutes.', weight: 26, income: { power: 3.0, duration: 300 } },
    { id: 'e_fortune', label: "Fortune's Favour", flavor: 'A permanent, substantial shift in your luck.', weight: 20, luck: 30 },
    { id: 'e_insider', label: 'Very Good Information', flavor: 'Market gains doubled for eight minutes.', weight: 14, market: { power: 2.0, duration: 480 } },
    { id: 'e_status', label: 'Status Symbol', flavor: 'Significant, permanent Flex — and the luck that comes with it.', weight: 12, flex: 45, luck: 5 },
  ],
  legendary: [
    { id: 'l_fortune', label: 'Life-Changing Money', flavor: 'A third of everything you are worth, again.', weight: 26, cashNetWorth: 0.34, cash: 17_000 },
    { id: 'l_empire', label: 'Empire Ascendant', flavor: 'Five times income across the board. Watch the counter move.', weight: 24, income: { power: 5.0, duration: 300 } },
    { id: 'l_golden', label: 'Golden Touch', flavor: 'A permanent transformation of your luck.', weight: 20, luck: 75, flex: 30 },
    { id: 'l_flow', label: 'Endless Deal Flow', flavor: 'Eight opportunities, all at once.', weight: 16, rolls: 8 },
    { id: 'l_autopilot', label: 'Perpetual Machine', flavor: 'Three more hours of offline earnings, forever.', weight: 14, offlineHours: 3, income: { power: 1.5, duration: 600 } },
  ],
  mythic: [
    {
      id: 'm_dynasty', label: 'Dynasty', flavor: 'Ten times income for ten minutes, and a permanent lift to everything else.',
      weight: 34, income: { power: 10, duration: 600 }, luck: 50, flex: 60,
    },
    {
      id: 'm_fortune', label: 'Obscene Fortune', flavor: 'Your entire net worth, handed to you in cash.',
      weight: 33, cashNetWorth: 1.0, cash: 50_000,
    },
    {
      id: 'm_untouchable', label: 'Untouchable', flavor: 'Permanent luck, permanent flex, permanent offline capacity, and a very good week.',
      weight: 33, luck: 150, flex: 150, offlineHours: 6, rolls: 5, income: { power: 3, duration: 900 },
    },
  ],
};

/** Legacy (prestige) upgrades, bought with Legacy Points after an IPO. */
export interface LegacyUpgradeDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  /** Human-readable effect per level. */
  effectLabel: (level: number) => string;
}

export const LEGACY_UPGRADES: LegacyUpgradeDef[] = [
  {
    id: 'income',
    name: 'Institutional Knowledge',
    description: 'Every business you ever open earns more, forever.',
    baseCost: 2,
    costGrowth: 1.55,
    maxLevel: 25,
    effectLabel: (l) => `+${(l * 12).toFixed(0)}% empire income`,
  },
  {
    id: 'luck',
    name: 'Reputation Precedes You',
    description: 'Start every run with a meaningful Luck head start.',
    baseCost: 2,
    costGrowth: 1.5,
    maxLevel: 25,
    effectLabel: (l) => `+${l * 20} starting Luck`,
  },
  {
    id: 'seed',
    name: 'Seed Capital',
    description: 'Begin each run with serious money instead of pocket change.',
    baseCost: 3,
    costGrowth: 1.7,
    maxLevel: 15,
    effectLabel: (l) => `Start with $${(1.5 * Math.pow(4, l)).toFixed(1)}K`,
  },
  {
    id: 'offline',
    name: 'Delegation',
    description: 'Your empire runs longer without you watching it.',
    baseCost: 3,
    costGrowth: 1.6,
    maxLevel: 12,
    effectLabel: (l) => `+${l * 2}h offline cap`,
  },
  {
    id: 'rollspeed',
    name: 'Deal Pipeline',
    description: 'Free roll tokens arrive faster.',
    baseCost: 2,
    costGrowth: 1.6,
    maxLevel: 12,
    effectLabel: (l) => `-${(l * 6).toFixed(0)}% roll cooldown`,
  },
  {
    id: 'cost',
    name: 'Buying Power',
    description: 'Everything you purchase costs less.',
    baseCost: 4,
    costGrowth: 1.75,
    maxLevel: 12,
    effectLabel: (l) => `-${(l * 4).toFixed(0)}% purchase costs`,
  },
  {
    id: 'flex',
    name: 'Old Money',
    description: 'Your luxury collection projects more status than it should.',
    baseCost: 3,
    costGrowth: 1.65,
    maxLevel: 12,
    effectLabel: (l) => `+${l * 15}% Flex from possessions`,
  },
];

export const LEGACY_BY_ID: Record<string, LegacyUpgradeDef> = Object.fromEntries(
  LEGACY_UPGRADES.map((u) => [u.id, u]),
);

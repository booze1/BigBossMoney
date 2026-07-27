import type { GameState, Rarity } from './types';
import { RARITY_ORDER, RARITY_META } from './content/tuning';
import { ROLL_TABLE, RollReward } from './content/luck';
import { netWorth, rarityWeights, totalLuck } from './selectors';
import { addBoost, addCash, addLog, grantRolls, setFlash } from './mutations';
import { money } from './format';

/**
 * The luck system. `rollRarity` is where the Luck stat actually pays off —
 * it reweights the rarity bands rather than rerolling, so a high-Luck player
 * sees Common results become genuinely uncommon.
 */

export function rollRarity(luck: number): Rarity {
  const weights = rarityWeights(luck);
  const total = RARITY_ORDER.reduce((sum, r) => sum + weights[r], 0);
  let roll = Math.random() * total;
  for (const r of RARITY_ORDER) {
    roll -= weights[r];
    if (roll <= 0) return r;
  }
  return 'common';
}

function pickReward(rarity: Rarity): RollReward {
  const table = ROLL_TABLE[rarity];
  const total = table.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of table) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return table[0];
}

export interface RollResult {
  rarity: Rarity;
  reward: RollReward;
  /** Human-readable summary of what was actually granted. */
  effects: string[];
}

/** Applies a roll's reward to the state in place and returns what happened. */
export function applyRoll(s: GameState): RollResult {
  const luck = totalLuck(s);
  const rarity = rollRarity(luck);
  const reward = pickReward(rarity);
  const effects: string[] = [];

  s.stats.rollsMade += 1;
  if (rarity === 'mythic') s.stats.mythicsPulled += 1;

  if (reward.cash !== undefined || reward.cashNetWorth !== undefined) {
    // Flat and proportional payouts compete; the proportional one takes over
    // once the empire is large enough for it to matter.
    const flat = reward.cash ?? 0;
    const proportional = Math.max(0, netWorth(s)) * (reward.cashNetWorth ?? 0);
    const amount = Math.max(flat, proportional);
    addCash(s, amount);
    effects.push(`${money(amount)} cash`);
  }

  if (reward.income) {
    addBoost(s, {
      label: reward.label,
      kind: 'income',
      power: reward.income.power,
      duration: reward.income.duration,
      rarity,
    });
    effects.push(`×${reward.income.power} income for ${Math.round(reward.income.duration / 60)}m`);
  }

  if (reward.market) {
    addBoost(s, {
      label: `${reward.label} (Markets)`,
      kind: 'market',
      power: reward.market.power,
      duration: reward.market.duration,
      rarity,
    });
    effects.push(`×${reward.market.power} trading gains for ${Math.round(reward.market.duration / 60)}m`);
  }

  if (reward.luck) {
    s.luck += reward.luck;
    effects.push(`+${reward.luck} Luck (permanent)`);
  }

  if (reward.flex) {
    // Flex from rolls is stored as a permanent flex boost so it survives
    // alongside possessions without needing a fake owned item.
    addBoost(s, {
      label: `${reward.label} (Status)`,
      kind: 'flex',
      power: reward.flex,
      duration: Infinity,
      rarity,
    });
    effects.push(`+${reward.flex} Flex (permanent)`);
  }

  if (reward.rolls) {
    grantRolls(s, reward.rolls);
    effects.push(`+${reward.rolls} roll tokens`);
  }

  if (reward.offlineHours) {
    s.legacyUpgrades['_offlineBonus'] = (s.legacyUpgrades['_offlineBonus'] ?? 0) + reward.offlineHours;
    effects.push(`+${reward.offlineHours}h offline cap (permanent)`);
  }

  const meta = RARITY_META[rarity];
  const tone = rarity === 'legendary' || rarity === 'mythic' ? 'epic' : rarity === 'common' ? 'neutral' : 'good';
  addLog(s, `${meta.name} roll — ${reward.label}: ${effects.join(', ')}`, tone);

  if (rarity === 'legendary' || rarity === 'mythic') {
    setFlash(s, `${meta.name.toUpperCase()} — ${reward.label}`, 'epic', rarity);
  }

  return { rarity, reward, effects };
}

/** Flex boosts granted by rolls count toward the Flex score. */
export function rollFlexBonus(s: GameState): number {
  return s.boosts.filter((b) => b.kind === 'flex').reduce((sum, b) => sum + b.power, 0);
}

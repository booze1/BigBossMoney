import type { CategoryId, CustomDesign, GameState, ManagerTier } from './types';
import { TUNING } from './content/tuning';
import { CATEGORY_BY_ID, MANAGER_BY_TIER } from './content/businesses';
import { DEVELOPMENT_BY_TYPE, generateCityListings } from './content/realestate';
import { LUXURY_BY_ID } from './content/luxury';
import { LEGACY_BY_ID } from './content/luck';
import {
  borrowingCapacity,
  businessCost,
  businessValue,
  costMultiplier,
  hireStaffCost,
  loanRate,
  managerHireCost,
  marketBoostMultiplier,
  maxStaff,
  hustlePayout,
  netWorth,
  projectedLegacyPoints,
  serviceYears,
  severanceFor,
  totalSeverance,
  propertyValue,
  rollCost,
  upgradeCost,
} from './selectors';
import { addCash, addLog, hire, setFlash } from './mutations';
import { applyRoll, type RollResult } from './rolls';
import { resolveEventChoice } from './events';
import { createBusiness, createInitialState } from './state';
import { tenureLabel } from './content/staff';
import { offersFor, traitPriceMultiplier } from './premises';
import { designById } from './custom';
import { money } from './format';
import { uid } from './rng';

export type Action =
  | { type: 'hustle' }
  | { type: 'viewPremises'; category: CategoryId }
  | { type: 'buyBusiness'; category: CategoryId; offerId?: string; designId?: string }
  | { type: 'saveDesign'; design: CustomDesign }
  | { type: 'deleteDesign'; id: string }
  | { type: 'upgradeBusiness'; id: string }
  | { type: 'renameBusiness'; id: string; name: string }
  | { type: 'hireStaff'; id: string }
  | { type: 'fireStaff'; id: string; memberId?: string }
  | { type: 'hireManager'; id: string; tier: ManagerTier }
  | { type: 'assignProperty'; businessId: string; propertyId: string | null }
  | { type: 'sellBusiness'; id: string }
  | { type: 'resolveEvent'; eventUid: string; choiceIndex: number }
  | { type: 'dismissEvent'; eventUid: string }
  | { type: 'roll' }
  | { type: 'buyAsset'; assetId: string; cash: number }
  | { type: 'sellAsset'; assetId: string; fraction: number }
  | { type: 'buyProperty'; propertyId: string }
  | { type: 'sellProperty'; propertyId: string }
  | { type: 'developProperty'; propertyId: string; devType: string }
  | { type: 'refreshListings'; cityId: string }
  | { type: 'buyLuxury'; itemId: string }
  | { type: 'sellLuxury'; index: number }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; loanId: string; amount: number }
  | { type: 'buyLegacy'; id: string }
  | { type: 'ipo' }
  | { type: 'bankruptcy' }
  | { type: 'clearFlash' }
  | { type: 'clearOfflineReport' }
  | { type: 'setSetting'; key: keyof GameState['settings']; value: boolean }
  | { type: 'seenIntro' }
  | { type: 'hardReset' };

/** Result of an action: a short message to surface as a toast, if any. */
export interface ActionResult {
  message?: string;
  tone?: 'good' | 'bad' | 'neutral';
  /** Populated by `roll` so the UI can animate the reveal. */
  roll?: RollResult;
}

export function apply(s: GameState, action: Action): ActionResult {
  switch (action.type) {
    // ------------------------------------------------------------- hustle
    case 'hustle': {
      // Gated in the engine rather than the UI so the cooldown cannot be
      // dispatched around by an autoclicker or a console call.
      if (s.hustleCooldown > 0) return {};
      s.hustleCooldown = TUNING.hustleCooldown;
      addCash(s, hustlePayout(s));
      return { message: `${money(hustlePayout(s), { sign: true })}`, tone: 'good' };
    }

    // ---------------------------------------------------------- businesses
    // Generating the shortlist is a mutation, so the UI asks for it explicitly
    // when the sheet opens rather than a selector quietly creating one during
    // render.
    case 'viewPremises': {
      offersFor(s, action.category);
      return {};
    }

    // A design is content, not progress: saving one only files it in the
    // catalogue. Opening a business from it is a separate, paid decision.
    case 'saveDesign': {
      const existing = s.designs.findIndex((d) => d.id === action.design.id);
      if (existing >= 0) s.designs[existing] = action.design;
      else s.designs.push(action.design);
      return { message: `${action.design.name} filed.`, tone: 'good' };
    }

    case 'deleteDesign': {
      const design = s.designs.find((d) => d.id === action.id);
      if (!design) return {};
      // Businesses already trading under it keep running — they hold their own
      // copy of everything except the deck, and losing the deck mid-run would
      // silently stop them surfacing decisions. Retiring is not demolition.
      if (s.businesses.some((b) => b.designId === action.id)) {
        return { message: `${design.name} is still trading. Sell it first.`, tone: 'bad' };
      }
      s.designs = s.designs.filter((d) => d.id !== action.id);
      return { message: `${design.name} retired.`, tone: 'neutral' };
    }

    case 'buyBusiness': {
      // A design overrides the category with its own archetype, so the caller
      // cannot open a design's business under the wrong economy by passing a
      // mismatched category.
      const design = action.designId ? designById(s, action.designId) : undefined;
      if (action.designId && !design) {
        return { message: 'That design is no longer in your catalogue.', tone: 'bad' };
      }
      if (design) return openFromDesign(s, design);

      const def = CATEGORY_BY_ID[action.category];
      const shortlist = offersFor(s, action.category);
      // No offer named means "just open one" — used by the headless tools and
      // by any caller that does not care which premises it gets.
      const offer = action.offerId
        ? shortlist.find((o) => o.id === action.offerId)
        : shortlist[0];
      if (!offer) return { message: 'That premises is no longer available.', tone: 'bad' };

      const cost = businessCost(s, def) * offer.priceMultiplier;
      if (s.cash < cost) return { message: 'Not enough cash.', tone: 'bad' };
      s.cash -= cost;

      const names = s.businesses.map((b) => b.name);
      const b = createBusiness(action.category, names, { name: offer.name, traits: offer.traits });
      s.businesses.push(b);
      s.stats.businessesFounded += 1;

      // The shortlist for this category is spent. A fresh one is generated on
      // the next look rather than now, so it reflects the empire as it is when
      // the player next goes shopping.
      delete s.premises[action.category];

      addLog(s, `Opened ${b.name} for ${money(cost)}.`, 'good');
      return { message: `${b.name} is open for business.`, tone: 'good' };
    }

    case 'upgradeBusiness': {
      const b = s.businesses.find((x) => x.id === action.id);
      if (!b) return {};
      const cost = upgradeCost(s, b);
      if (s.cash < cost) return { message: 'Not enough cash.', tone: 'bad' };
      s.cash -= cost;
      b.level += 1;
      return { message: `${b.name} upgraded to level ${b.level}.`, tone: 'good' };
    }

    case 'renameBusiness': {
      const b = s.businesses.find((x) => x.id === action.id);
      if (!b) return {};
      const name = action.name.trim().slice(0, 40);
      if (name) b.name = name;
      return {};
    }

    case 'hireStaff': {
      const b = s.businesses.find((x) => x.id === action.id);
      if (!b) return {};
      if (b.roster.length >= maxStaff(b)) {
        return { message: 'Upgrade the business for more headcount.', tone: 'bad' };
      }
      const cost = hireStaffCost(s, b);
      if (s.cash < cost) return { message: 'Not enough cash to cover the signing cost.', tone: 'bad' };
      s.cash -= cost;
      const member = hire(b, designById(s, b.designId)?.staffRoles);
      return { message: `${member.name} starts ${member.role}.`, tone: 'good' };
    }

    case 'fireStaff': {
      const b = s.businesses.find((x) => x.id === action.id);
      if (!b || b.roster.length === 0) return {};
      // Without a named target this is the "-" button, which lets the newest
      // hire go: the cheapest in severance and the least painful to lose.
      const index = action.memberId
        ? b.roster.findIndex((m) => m.id === action.memberId)
        : b.roster.length - 1;
      if (index < 0) return {};
      const member = b.roster[index];

      // Severance is capped at whatever cash is on hand rather than blocking
      // the action. A player who cannot afford to make cuts is trapped, and
      // being trapped is not the same as being under pressure.
      const owed = Math.min(Math.max(0, s.cash), severanceFor(s, b, member));
      s.cash -= owed;
      b.roster.splice(index, 1);

      // Letting go of someone with years in hits the room harder.
      const years = serviceYears(member);
      b.morale = Math.max(TUNING.moraleMin, b.morale - 0.04 - Math.min(0.06, years * 0.008));

      addLog(
        s,
        `${member.name} left ${b.name} after ${tenureLabel(years)}. Severance ${money(owed)}.`,
        'bad',
      );
      return {
        message: `${member.name} is gone. ${tenureLabel(years)} of service, ${money(owed)} owed.`,
        tone: 'neutral',
      };
    }

    case 'hireManager': {
      const b = s.businesses.find((x) => x.id === action.id);
      if (!b) return {};
      const def = MANAGER_BY_TIER[action.tier];
      if (action.tier === 'none') {
        b.manager = 'none';
        return { message: 'You are running it personally again.', tone: 'neutral' };
      }
      const cost = managerHireCost(s, b, action.tier);
      if (s.cash < cost) return { message: 'Not enough cash for the signing package.', tone: 'bad' };
      s.cash -= cost;
      b.manager = action.tier;
      addLog(s, `${def.name} hired at ${b.name} for ${money(cost)}.`, 'good');
      return { message: `${def.name} starts Monday.`, tone: 'good' };
    }

    case 'assignProperty': {
      const b = s.businesses.find((x) => x.id === action.businessId);
      if (!b) return {};
      if (action.propertyId === null) {
        b.propertyId = null;
        return { message: `${b.name} is back to renting.`, tone: 'neutral' };
      }
      const p = s.properties.find((x) => x.id === action.propertyId);
      if (!p || !p.owned || p.kind !== 'commercial') return { message: 'That property cannot house a business.', tone: 'bad' };
      const occupant = s.businesses.find((x) => x.propertyId === p.id && x.id !== b.id);
      if (occupant) return { message: `${occupant.name} already occupies that unit.`, tone: 'bad' };
      b.propertyId = p.id;
      return { message: `${b.name} now operates out of property you own. Rent gone, margin up.`, tone: 'good' };
    }

    case 'sellBusiness': {
      const b = s.businesses.find((x) => x.id === action.id);
      if (!b) return {};
      if (s.businesses.length <= 1) return { message: 'You need at least one business.', tone: 'bad' };
      // Everyone on the books is paid off out of the proceeds. Closing a place
      // with people who have been there for years costs real money, which is
      // the point: a business is not just a line item you can delete.
      const owed = totalSeverance(s, b);
      const gross = businessValue(b) * 0.75;
      const proceeds = Math.max(0, gross - owed);
      addCash(s, proceeds);

      const headcount = b.roster.length;
      s.businesses = s.businesses.filter((x) => x.id !== b.id);
      s.pendingEvents = s.pendingEvents.filter((e) => e.businessId !== b.id);

      const staffNote =
        headcount > 0
          ? ` ${headcount} ${headcount === 1 ? 'person' : 'people'} paid off, ${money(owed)}.`
          : '';
      addLog(s, `Sold ${b.name} for ${money(gross)}.${staffNote}`, 'neutral');
      return { message: `Sold ${b.name} for ${money(proceeds)} net.${staffNote}`, tone: 'neutral' };
    }

    // -------------------------------------------------------------- events
    case 'resolveEvent': {
      const pending = s.pendingEvents.find((e) => e.uid === action.eventUid);
      if (!pending) return {};
      const result = resolveEventChoice(s, pending.businessId, pending.defId, action.choiceIndex);
      s.pendingEvents = s.pendingEvents.filter((e) => e.uid !== action.eventUid);
      if (!result) return {};
      return {
        message: result.effects.length > 0 ? result.effects.join(' · ') : undefined,
        tone: result.success ? 'good' : 'bad',
      };
    }

    case 'dismissEvent': {
      s.pendingEvents = s.pendingEvents.filter((e) => e.uid !== action.eventUid);
      return {};
    }

    // --------------------------------------------------------------- rolls
    case 'roll': {
      if (s.rollTokens > 0) {
        s.rollTokens -= 1;
      } else {
        const cost = rollCost(s);
        if (s.cash < cost) return { message: 'No tokens and not enough cash.', tone: 'bad' };
        s.cash -= cost;
      }
      const result = applyRoll(s);
      return {
        message: `${result.reward.label}: ${result.effects.join(', ')}`,
        tone: 'good',
        roll: result,
      };
    }

    // ------------------------------------------------------------- markets
    case 'buyAsset': {
      const asset = s.assets.find((a) => a.id === action.assetId);
      if (!asset) return {};
      const spend = Math.min(action.cash, s.cash);
      if (spend <= 0) return { message: 'No cash available.', tone: 'bad' };
      const net = spend * (1 - TUNING.tradingFee);
      const units = net / asset.price;
      s.cash -= spend;

      const existing = s.holdings.find((h) => h.assetId === asset.id);
      if (existing) {
        const totalCost = existing.units * existing.costBasis + net;
        existing.units += units;
        existing.costBasis = totalCost / existing.units;
      } else {
        s.holdings.push({ assetId: asset.id, units, costBasis: asset.price });
      }
      return { message: `Bought ${units.toFixed(units < 1 ? 6 : 2)} ${asset.ticker}.`, tone: 'neutral' };
    }

    case 'sellAsset': {
      const asset = s.assets.find((a) => a.id === action.assetId);
      const holding = s.holdings.find((h) => h.assetId === action.assetId);
      if (!asset || !holding) return {};
      const units = holding.units * Math.min(1, Math.max(0, action.fraction));
      if (units <= 0) return {};

      const gross = units * asset.price * (1 - TUNING.tradingFee);
      const cost = units * holding.costBasis;
      const profit = gross - cost;

      // Market boosts amplify realised profits only — they never soften a loss.
      const bonus = profit > 0 ? profit * (marketBoostMultiplier(s) - 1) : 0;
      addCash(s, gross + bonus);

      holding.units -= units;
      if (holding.units <= 1e-9) s.holdings = s.holdings.filter((h) => h.assetId !== action.assetId);

      const tone = profit >= 0 ? 'good' : 'bad';
      return {
        message: `Sold ${asset.ticker} for ${money(gross + bonus)} (${money(profit + bonus, { sign: true })})`,
        tone,
      };
    }

    // --------------------------------------------------------- real estate
    case 'buyProperty': {
      const p = s.properties.find((x) => x.id === action.propertyId);
      if (!p || p.owned) return {};
      const price = propertyValue(s, p);
      if (s.cash < price) return { message: 'Not enough cash.', tone: 'bad' };
      s.cash -= price;
      p.owned = true;
      p.purchasePrice = price;
      addLog(s, `Acquired ${p.name} for ${money(price)}.`, 'good');
      return { message: `${p.name} acquired.`, tone: 'good' };
    }

    case 'sellProperty': {
      const p = s.properties.find((x) => x.id === action.propertyId);
      if (!p || !p.owned) return {};
      if (p.development) return { message: 'You cannot sell a site mid-build.', tone: 'bad' };
      const occupant = s.businesses.find((b) => b.propertyId === p.id);
      if (occupant) occupant.propertyId = null;

      const proceeds = propertyValue(s, p) * (1 - TUNING.propertySaleFee);
      const gain = proceeds - p.purchasePrice;
      addCash(s, proceeds);
      s.properties = s.properties.filter((x) => x.id !== p.id);
      addLog(s, `Sold ${p.name} for ${money(proceeds)} (${money(gain, { sign: true })}).`, gain >= 0 ? 'good' : 'bad');
      return { message: `Sold for ${money(proceeds)} · ${money(gain, { sign: true })}`, tone: gain >= 0 ? 'good' : 'bad' };
    }

    case 'developProperty': {
      const p = s.properties.find((x) => x.id === action.propertyId);
      const dev = DEVELOPMENT_BY_TYPE[action.devType];
      if (!p || !dev || !p.owned || p.development || p.developedType) return {};
      if (p.kind !== 'land') return { message: 'Only land can be developed.', tone: 'bad' };

      const cost = propertyValue(s, p) * dev.costRatio;
      if (s.cash < cost) return { message: 'Not enough cash for the build.', tone: 'bad' };
      s.cash -= cost;
      p.development = {
        type: dev.type,
        label: dev.label,
        remaining: dev.buildSeconds,
        totalTime: dev.buildSeconds,
        valueMultiplier: dev.valueMultiplier,
        yieldBonus: dev.yieldBonus,
      };
      addLog(s, `Broke ground on ${dev.label} at ${p.name}.`, 'neutral');
      return { message: `${dev.label} under construction.`, tone: 'good' };
    }

    case 'refreshListings': {
      const cost = 5_000 + Math.max(0, netWorth(s)) * 0.0008;
      if (s.cash < cost) return { message: 'Not enough cash for new search fees.', tone: 'bad' };
      s.cash -= cost;
      s.properties = [
        ...s.properties.filter((p) => p.owned || p.cityId !== action.cityId),
        ...generateCityListings(action.cityId, TUNING.listingsPerCity),
      ];
      return { message: 'Fresh listings pulled.', tone: 'neutral' };
    }

    // -------------------------------------------------------------- luxury
    case 'buyLuxury': {
      const def = LUXURY_BY_ID[action.itemId];
      if (!def) return {};
      const price = def.price * costMultiplier(s);
      if (s.cash < price) return { message: 'Not enough cash.', tone: 'bad' };
      s.cash -= price;
      // Value starts at what you actually paid, so purchase discounts can
      // never be flipped for a risk-free profit.
      s.luxury.push({ itemId: def.id, value: price, purchasedAt: Date.now() });
      addLog(s, `Bought a ${def.name}. +${def.flex} Flex.`, 'good');
      return { message: `${def.brand} ${def.name} acquired. +${def.flex} Flex.`, tone: 'good' };
    }

    case 'sellLuxury': {
      const owned = s.luxury[action.index];
      if (!owned) return {};
      const def = LUXURY_BY_ID[owned.itemId];
      const proceeds = owned.value * 0.92;
      addCash(s, proceeds);
      s.luxury.splice(action.index, 1);
      const gain = proceeds - def.price;
      return { message: `Sold for ${money(proceeds)} · ${money(gain, { sign: true })}`, tone: gain >= 0 ? 'good' : 'bad' };
    }

    // ---------------------------------------------------------------- debt
    case 'borrow': {
      const capacity = borrowingCapacity(s);
      const amount = Math.min(action.amount, capacity);
      if (amount <= 0) return { message: 'No borrowing capacity left.', tone: 'bad' };
      addCash(s, amount);
      s.debt.push({ id: uid('loan'), principal: amount, rate: loanRate(s), takenAt: Date.now() });
      addLog(s, `Borrowed ${money(amount)}.`, 'neutral');
      return { message: `Borrowed ${money(amount)}.`, tone: 'neutral' };
    }

    case 'repay': {
      const loan = s.debt.find((l) => l.id === action.loanId);
      if (!loan) return {};
      const amount = Math.min(action.amount, loan.principal, s.cash);
      if (amount <= 0) return { message: 'Nothing to repay with.', tone: 'bad' };
      s.cash -= amount;
      loan.principal -= amount;
      s.debt = s.debt.filter((l) => l.principal > 1);
      return { message: `Repaid ${money(amount)}.`, tone: 'good' };
    }

    // ------------------------------------------------------------- legacy
    case 'buyLegacy': {
      const def = LEGACY_BY_ID[action.id];
      if (!def) return {};
      const level = s.legacyUpgrades[def.id] ?? 0;
      if (level >= def.maxLevel) return { message: 'Already maxed.', tone: 'bad' };
      const cost = Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
      if (s.legacyPoints < cost) return { message: 'Not enough Legacy Points.', tone: 'bad' };
      s.legacyPoints -= cost;
      s.legacyUpgrades[def.id] = level + 1;
      return { message: `${def.name} → level ${level + 1}`, tone: 'good' };
    }

    case 'ipo': {
      const points = projectedLegacyPoints(s);
      if (points <= 0) return { message: 'You are not big enough to go public yet.', tone: 'bad' };
      const stats = { ...s.stats, ipos: s.stats.ipos + 1, peakNetWorth: 0 };
      const carry = {
        legacyPoints: s.legacyPoints + points,
        legacyUpgrades: s.legacyUpgrades,
        stats,
        // The empire goes; the ideas stay.
        designs: s.designs,
      };
      Object.assign(s, createInitialState(carry));
      setFlash(s, `IPO COMPLETE — +${points} Legacy Points`, 'epic', 'legendary');
      addLog(s, `You took the empire public and walked away with ${points} Legacy Points.`, 'epic');
      return { message: `IPO complete. +${points} Legacy Points.`, tone: 'good' };
    }

    case 'bankruptcy': {
      const peak = s.stats.peakNetWorth;
      const raw = TUNING.legacyPointsFactor * Math.sqrt(Math.max(0, peak) / TUNING.legacyPointsReference);
      const points = Math.max(1, Math.floor(raw * TUNING.bankruptcyLegacyRatio));
      const stats = { ...s.stats, bankruptcies: s.stats.bankruptcies + 1, peakNetWorth: 0 };
      const carry = {
        legacyPoints: s.legacyPoints + points,
        legacyUpgrades: s.legacyUpgrades,
        stats,
        // The empire goes; the ideas stay.
        designs: s.designs,
      };
      Object.assign(s, createInitialState(carry));
      addLog(s, `Chapter 11. You keep the scars and ${points} Legacy Points. Start again.`, 'bad');
      return { message: `Bankrupt. +${points} Legacy Points.`, tone: 'bad' };
    }

    // --------------------------------------------------------------- misc
    case 'clearFlash':
      s.flash = null;
      return {};

    case 'clearOfflineReport':
      s.offlineReport = null;
      return {};

    case 'setSetting':
      s.settings[action.key] = action.value;
      return {};

    case 'seenIntro':
      s.seenIntro = true;
      return {};

    case 'hardReset':
      Object.assign(s, createInitialState());
      return { message: 'Everything wiped. Fresh start.', tone: 'neutral' };
  }
}


/**
 * Opens a business from a design. Priced as its archetype, because that is what
 * it economically is, and stamped with the design's identity, traits and deck.
 */
function openFromDesign(s: GameState, design: CustomDesign): ActionResult {
  const def = CATEGORY_BY_ID[design.archetype];
  // Trait price multipliers apply exactly as they do on the premises
  // shortlist, so a design that asked for a good trait pays for it.
  const cost = businessCost(s, def) * traitPriceMultiplier(design.traits);
  if (s.cash < cost) return { message: 'Not enough cash.', tone: 'bad' };
  s.cash -= cost;

  const names = s.businesses.map((b) => b.name);
  const b = createBusiness(design.archetype, names, {
    name: design.name,
    traits: design.traits,
    designId: design.id,
  });
  s.businesses.push(b);
  s.stats.businessesFounded += 1;

  design.timesOpened += 1;
  // Counted once per run, so "on run 4" means four runs and not four shops.
  if (!s.businesses.some((x) => x.designId === design.id && x.id !== b.id)) {
    design.runsOpened += 1;
  }

  addLog(s, `Opened ${b.name} for ${money(cost)}. ${design.tagline}`, 'good');
  return { message: `${b.name} is open for business.`, tone: 'good' };
}

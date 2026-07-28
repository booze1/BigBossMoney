import { useState } from 'react';
import { useGame } from '../../store';
import type { Business, CategoryId } from '../../engine/types';
import { TRAIT_BY_ID } from '../../engine/content/traits';
import { tenureLabel } from '../../engine/content/staff';
import { CATEGORIES, CATEGORY_BY_ID, MANAGERS, MANAGER_BY_TIER, MANAGER_ORDER } from '../../engine/content/businesses';
import { TUNING } from '../../engine/content/tuning';
import {
  businessCost,
  businessFinancials,
  businessIncome,
  businessValue,
  flexScore,
  hireStaffCost,
  hustlePayout,
  isCategoryUnlocked,
  managerHireCost,
  maxStaff,
  serviceYears,
  severanceFor,
  tenureWeight,
  totalSeverance,
  nextSaturation,
  upgradeCost,
} from '../../engine/selectors';
import { clock, money, rate, pct } from '../../engine/format';
import { Card, Chip, ListRow, Meter, Modal, SectionLabel, Empty } from '../components/common';
import { DesignPreview, DesignSheet } from './DesignSheet';
import { displayFor } from '../../engine/custom';
import { traitPriceMultiplier } from '../../engine/premises';

export function EmpireScreen() {
  const { state, dispatch } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  const [shoppingIn, setShoppingIn] = useState<CategoryId | null>(null);
  const [designing, setDesigning] = useState(false);

  const income = businessIncome(state);
  const open = state.businesses.find((b) => b.id === openId) ?? null;

  const hustleAmount = hustlePayout(state);
  const hustleReady = state.hustleCooldown <= 0;
  // The hustle button matters only while the empire is small; once businesses
  // out-earn it several times over it collapses into a quiet secondary action.
  const hustleIsMeaningful = hustleAmount > income * 1.5;

  return (
    <div className="screen">
      {state.boosts.length > 0 && <ActiveBoosts />}

      <button
        className={`btn ${hustleIsMeaningful ? 'btn-primary btn-hero' : 'btn-ghost btn-block btn-sm'}`}
        onClick={() => dispatch({ type: 'hustle' })}
        disabled={!hustleReady}
        style={{ marginBottom: 12 }}
      >
        {hustleIsMeaningful ? `Work the floor — ${money(hustleAmount)}` : `Work the floor (${money(hustleAmount)})`}
      </button>

      <SectionLabel>Your businesses · {money(income)}/s net</SectionLabel>
      <Card flush>
        {state.businesses.map((b) => (
          <BusinessRow key={b.id} business={b} onOpen={() => setOpenId(b.id)} />
        ))}
      </Card>

      <SectionLabel>Your own</SectionLabel>
      {state.designs.map((design) => {
        const cost =
          businessCost(state, CATEGORY_BY_ID[design.archetype]) * traitPriceMultiplier(design.traits);
        const affordable = state.cash >= cost;
        const trading = state.businesses.filter((b) => b.designId === design.id).length;

        return (
          <div key={design.id}>
            <DesignPreview design={design} compact />
            <button
              className={`btn btn-block ${affordable ? 'btn-primary' : ''}`}
              style={{ marginTop: -4, marginBottom: 12 }}
              disabled={!affordable}
              onClick={() =>
                dispatch({ type: 'buyBusiness', category: design.archetype, designId: design.id })
              }
            >
              {!affordable
                ? `Need ${money(cost)}`
                : trading > 0
                  ? `Open another — ${money(cost)}`
                  : `Open ${design.name} — ${money(cost)}`}
            </button>
          </div>
        );
      })}
      <button
        className={`btn btn-block ${state.designs.length === 0 ? 'btn-primary' : 'btn-ghost'}`}
        style={{ marginBottom: 16 }}
        onClick={() => setDesigning(true)}
      >
        {state.designs.length === 0 ? 'Design your own business' : 'Design another'}
      </button>

      <SectionLabel>Open something new</SectionLabel>
      {CATEGORIES.map((def) => {
        const unlocked = isCategoryUnlocked(state, def);
        const cost = businessCost(state, def);
        const owned = state.businesses.filter((b) => b.category === def.id).length;
        const affordable = state.cash >= cost;
        const saturation = nextSaturation(state, def.id);

        return (
          <Card key={def.id} className={unlocked ? '' : 'locked'}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="avatar" style={{ borderColor: unlocked ? def.accent + '55' : undefined }}>
                {def.icon}
              </div>
              <div className="grow">
                <div className="row">
                  <span style={{ fontWeight: 600 }}>{def.name}</span>
                  {owned > 0 && <span className="faint num" style={{ fontSize: 12 }}>×{owned}</span>}
                </div>
                <div className="hint" style={{ marginTop: 2 }}>{def.blurb}</div>
                <div className="chiprow" style={{ marginTop: 8 }}>
                  <Chip>
                    {money(def.baseRevenue * saturation * (1 - def.upkeepRatio - TUNING.rentRatio))}/s
                    {' '}while renting
                  </Chip>
                  <Chip>{pct(1 - def.upkeepRatio, 0)} margin</Chip>
                  {saturation < 0.999 && (
                    <Chip tone="warn">{pct(saturation, 0)} of full output</Chip>
                  )}
                </div>
                {saturation < 0.999 && (
                  <div className="hint" style={{ marginTop: 6 }}>
                    You already run {owned} here. Each additional {def.name.toLowerCase()} earns less
                    than the last — try a different category, or put the money into property.
                  </div>
                )}
              </div>
            </div>
            <button
              className={`btn btn-block ${affordable && unlocked ? 'btn-primary' : ''}`}
              style={{ marginTop: 11 }}
              disabled={!unlocked}
              onClick={() => {
                dispatch({ type: 'viewPremises', category: def.id });
                setShoppingIn(def.id);
              }}
            >
              {!unlocked
                ? `Unlocks at ${money(def.unlockAt)} net worth`
                : `See what's available — around ${money(cost)}`}
            </button>
          </Card>
        );
      })}

      {designing && <DesignSheet onClose={() => setDesigning(false)} />}
      {shoppingIn && (
        <PremisesSheet category={shoppingIn} onClose={() => setShoppingIn(null)} />
      )}
      {open && <BusinessDetail business={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ActiveBoosts() {
  const { state } = useGame();
  const sorted = [...state.boosts].sort((a, b) => a.remaining - b.remaining);

  return (
    <>
      <SectionLabel>Active boosts</SectionLabel>
      <Card>
        <div className="stack">
          {sorted.map((b) => (
            <div key={b.id} className="row">
              <div className="grow truncate" style={{ fontSize: 13 }}>
                <span style={{ color: `var(--${b.rarity})` }}>●</span> {b.label}
                {b.category && <span className="faint"> · {CATEGORY_BY_ID[b.category].plural}</span>}
              </div>
              <span className="num pos" style={{ fontSize: 13 }}>
                {b.kind === 'income' || b.kind === 'market' ? `×${b.power.toFixed(2)}` : `+${b.power}`}
              </span>
              <span className="num faint" style={{ fontSize: 12, minWidth: 42, textAlign: 'right' }}>
                {clock(b.remaining)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function BusinessRow({ business, onOpen }: { business: Business; onOpen: () => void }) {
  const { state } = useGame();
  // A designed business wears its own icon and name rather than its
  // archetype's — the archetype is how it earns, not what it is.
  const look = displayFor(state, business);
  const fin = businessFinancials(state, business);
  const manager = MANAGER_BY_TIER[business.manager];

  return (
    <ListRow onClick={onOpen} label={`${business.name}, level ${business.level}`}>
      <div className="avatar" style={{ borderColor: look.accent + '55' }}>{look.icon}</div>
      <div className="grow">
        <div className="row row-tight">
          <span className="truncate" style={{ fontWeight: 580 }}>{business.name}</span>
          <span className="faint num" style={{ fontSize: 11 }}>Lv{business.level}</span>
        </div>
        <div className="row" style={{ marginTop: 3 }}>
          <span className="faint" style={{ fontSize: 11.5 }}>
            {business.roster.length}/{maxStaff(business)} staff
            {business.manager !== 'none' && ` · ${manager.name}`}
            {business.propertyId && ' · owns premises'}
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          <Meter
            value={(business.morale - TUNING.moraleMin) / (TUNING.moraleMax - TUNING.moraleMin)}
            color={business.morale >= 1 ? 'var(--pos)' : 'var(--warn)'}
          />
        </div>
      </div>
      <div className="col" style={{ alignItems: 'flex-end', flex: 'none' }}>
        <span className={`num ${fin.net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 14, fontWeight: 600 }}>
          {rate(fin.net)}
        </span>
        {fin.boostMultiplier > 1.02 && (
          <span className="num" style={{ fontSize: 10.5, color: 'var(--epic)' }}>
            ×{fin.boostMultiplier.toFixed(2)}
          </span>
        )}
      </div>
    </ListRow>
  );
}

function BusinessDetail({ business, onClose }: { business: Business; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<'ops' | 'staff' | 'premises'>('ops');

  const look = displayFor(state, business);
  const fin = businessFinancials(state, business);
  const upCost = upgradeCost(state, business);

  return (
    <Modal open onClose={onClose}>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="avatar" style={{ borderColor: look.accent + '55' }}>{look.icon}</div>
        <div className="grow">
          <input
            className="textinput"
            style={{ fontWeight: 640, fontSize: 16, padding: '6px 8px', background: 'transparent', border: 'none' }}
            value={business.name}
            onChange={(e) => dispatch({ type: 'renameBusiness', id: business.id, name: e.target.value })}
          />
          <div className="faint" style={{ fontSize: 12, paddingLeft: 8 }}>
            {look.name} · Level {business.level}
          </div>
        </div>
      </div>

      {business.traits.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <TraitChips traits={business.traits} />
          {business.traits.map((id) => {
            const t = TRAIT_BY_ID[id];
            return t ? (
              <div key={id} className="hint" style={{ marginTop: 6 }}>
                <span style={{ fontWeight: 560 }}>{t.name}.</span> {t.blurb}
              </div>
            ) : null;
          })}
        </div>
      )}

      <div className="tiles" style={{ marginBottom: 12 }}>
        <div className="tile">
          <div className="tile-label">Net / sec</div>
          <div className={`tile-value num ${fin.net >= 0 ? 'pos' : 'neg'}`}>{money(fin.net)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Morale</div>
          <div className="tile-value num">{pct(business.morale, 0)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Value</div>
          <div className="tile-value num">{money(businessValue(business))}</div>
        </div>
      </div>

      <div className="segmented">
        {(['ops', 'staff', 'premises'] as const).map((t) => (
          <button key={t} className={`segment ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'ops' ? 'Operations' : t === 'staff' ? 'People' : 'Premises'}
          </button>
        ))}
      </div>

      {tab === 'ops' && (
        <>
          <Card>
            <div className="card-head">
              <span className="card-title">Income breakdown</span>
            </div>
            <div className="stack" style={{ fontSize: 13 }}>
              {fin.saturation < 0.999 && (
              <div className="row">
                <span className="dim">Market saturation</span>
                <span className="num warn">{pct(fin.saturation, 0)} of full output</span>
              </div>
            )}
            <div className="row"><span className="dim">Gross revenue</span><span className="num pos">{rate(fin.gross)}</span></div>
              <div className="row"><span className="dim">Operating costs</span><span className="num neg">{rate(-(fin.upkeep - fin.wages - fin.rent - fin.managerSalary))}</span></div>
              {fin.rent > 0 && <div className="row"><span className="dim">Rent</span><span className="num neg">{rate(-fin.rent)}</span></div>}
              {fin.wages > 0 && <div className="row"><span className="dim">Wages</span><span className="num neg">{rate(-fin.wages)}</span></div>}
              {fin.managerSalary > 0 && <div className="row"><span className="dim">Manager salary</span><span className="num neg">{rate(-fin.managerSalary)}</span></div>}
              <div className="divider" />
              <div className="row"><span style={{ fontWeight: 600 }}>Net</span><span className={`num ${fin.net >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 640 }}>{rate(fin.net)}</span></div>
            </div>
          </Card>

          <button
            className={`btn btn-block ${state.cash >= upCost ? 'btn-primary' : ''}`}
            disabled={state.cash < upCost}
            onClick={() => dispatch({ type: 'upgradeBusiness', id: business.id })}
          >
            Upgrade to level {business.level + 1} — {money(upCost)}
          </button>
          <div className="hint" style={{ textAlign: 'center', marginTop: 6 }}>
            +{pct(TUNING.revenuePerLevel - 1, 0)} revenue and +{TUNING.staffPerLevel} headcount capacity
          </div>

          <div className="divider" />
          <button
            className="btn btn-neg btn-block btn-sm"
            disabled={state.businesses.length <= 1}
            onClick={() => {
              dispatch({ type: 'sellBusiness', id: business.id });
              onClose();
            }}
          >
            Sell for {money(businessValue(business) * 0.75)}
          </button>
        </>
      )}

      {tab === 'staff' && <StaffTab business={business} />}
      {tab === 'premises' && <PremisesTab business={business} />}
    </Modal>
  );
}

function StaffTab({ business }: { business: Business }) {
  const { state, dispatch } = useGame();
  const cost = hireStaffCost(state, business);
  const cap = maxStaff(business);
  const flex = flexScore(state);

  return (
    <>
      <Card>
        <div className="card-head">
          <span className="card-title">Headcount</span>
          <span className="num dim">{business.roster.length} / {cap}</span>
        </div>
        <Meter value={cap > 0 ? business.roster.length / cap : 0} />
        <div className="hint" style={{ marginTop: 8 }}>
          Each hire adds {pct(TUNING.staffRevenueBonus, 0)} revenue and a permanent wage, and grows
          worth up to {pct(TUNING.tenureBonusMax, 0)} more the longer they stay. Upgrade the business
          to raise the cap.
        </div>
        <button
          className={`btn btn-block btn-sm ${
            state.cash >= cost && business.roster.length < cap ? 'btn-primary' : ''
          }`}
          style={{ marginTop: 11 }}
          disabled={state.cash < cost || business.roster.length >= cap}
          onClick={() => dispatch({ type: 'hireStaff', id: business.id })}
        >
          {business.roster.length >= cap ? 'Fully staffed' : `Take someone on — ${money(cost)}`}
        </button>
      </Card>

      {business.roster.length > 0 && (
        <>
          <SectionLabel>On the books</SectionLabel>
          <Card flush>
            {business.roster.map((member) => {
              const years = serviceYears(member);
              const owed = severanceFor(state, business, member);
              return (
                <div key={member.id} className="listrow-static">
                  <div className="grow">
                    <div className="row row-tight">
                      <span style={{ fontWeight: 560 }}>{member.name}</span>
                      {years >= 3 && (
                        <span className="chip chip-pos" style={{ fontSize: 10 }}>
                          +{pct(tenureWeight(member) - 1, 0)}
                        </span>
                      )}
                    </div>
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {member.role} · {tenureLabel(years)}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 'none' }}
                    onClick={() => dispatch({ type: 'fireStaff', id: business.id, memberId: member.id })}
                    aria-label={`Let ${member.name} go, ${money(owed)} severance`}
                  >
                    Let go · {money(owed)}
                  </button>
                </div>
              );
            })}
          </Card>
          <div className="hint" style={{ marginTop: 8, marginBottom: 4 }}>
            Severance grows with service. Closing this business pays all of it at once —
            {' '}{money(totalSeverance(state, business))} as things stand.
          </div>
        </>
      )}

      <SectionLabel>Management</SectionLabel>
      <div className="hint" style={{ marginBottom: 10 }}>
        A manager resolves this business's event cards for you at reduced payoff, so you can spend
        your attention elsewhere. Running it yourself always pays the most.
      </div>

      {MANAGER_ORDER.map((tier) => {
        const def = MANAGERS.find((m) => m.tier === tier)!;
        const isCurrent = business.manager === tier;
        const hireCost = managerHireCost(state, business, tier);
        const flexLocked = flex < def.flexRequired;
        const affordable = state.cash >= hireCost;

        return (
          <Card key={tier} className={flexLocked ? 'locked' : ''}>
            <div className="row">
              <div className="grow">
                <div className="row">
                  <span style={{ fontWeight: 600 }}>{def.name}</span>
                  {isCurrent && <Chip tone="pos">Current</Chip>}
                </div>
                <div className="hint" style={{ marginTop: 2 }}>{def.blurb}</div>
                <div className="chiprow" style={{ marginTop: 7 }}>
                  {def.efficiency > 0 && <Chip>{pct(def.efficiency, 0)} auto payoff</Chip>}
                  {def.revenueBonus > 1 && <Chip tone="pos">+{pct(def.revenueBonus - 1, 0)} revenue</Chip>}
                  {def.salaryRatio > 0 && <Chip tone="neg">salary</Chip>}
                  {def.flexRequired > 0 && (
                    <Chip tone={flexLocked ? 'warn' : undefined}>{def.flexRequired} Flex</Chip>
                  )}
                </div>
              </div>
            </div>
            {!isCurrent && (
              <button
                className={`btn btn-block btn-sm ${affordable && !flexLocked ? 'btn-primary' : ''}`}
                style={{ marginTop: 10 }}
                disabled={flexLocked || (tier !== 'none' && !affordable)}
                onClick={() => dispatch({ type: 'hireManager', id: business.id, tier })}
              >
                {tier === 'none' ? 'Take back control' : `Hire — ${money(hireCost)}`}
              </button>
            )}
          </Card>
        );
      })}
    </>
  );
}

function PremisesTab({ business }: { business: Business }) {
  const { state, dispatch } = useGame();

  const commercial = state.properties.filter(
    (p) => p.owned && p.kind === 'commercial' && !p.development,
  );
  const current = state.properties.find((p) => p.id === business.propertyId);

  return (
    <>
      <Card>
        <div className="card-head">
          <span className="card-title">Premises</span>
        </div>
        {current ? (
          <>
            <div style={{ fontWeight: 580 }}>{current.name}</div>
            <div className="hint" style={{ marginTop: 4 }}>
              You own this building. No rent, and a {pct(TUNING.ownedPropertyMarginBonus, 0)} wider margin.
            </div>
            <button
              className="btn btn-ghost btn-block btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => dispatch({ type: 'assignProperty', businessId: business.id, propertyId: null })}
            >
              Move out and rent instead
            </button>
          </>
        ) : (
          <div className="hint">
            This business rents, costing {pct(TUNING.rentRatio, 0)} of revenue. Buy a commercial
            property on the Estate screen and move in to remove the rent entirely and widen the
            margin by {pct(TUNING.ownedPropertyMarginBonus, 0)}.
          </div>
        )}
      </Card>

      {commercial.length > 0 && (
        <>
          <SectionLabel>Available commercial units</SectionLabel>
          <Card flush>
            {commercial.map((p) => {
              const occupant = state.businesses.find((b) => b.propertyId === p.id);
              const taken = occupant && occupant.id !== business.id;
              return (
                <div key={p.id} className="listrow">
                  <div className="grow">
                    <div className="truncate" style={{ fontWeight: 560 }}>{p.name}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>
                      {taken ? `Occupied by ${occupant!.name}` : 'Vacant'}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    disabled={!!taken || business.propertyId === p.id}
                    onClick={() => dispatch({ type: 'assignProperty', businessId: business.id, propertyId: p.id })}
                  >
                    {business.propertyId === p.id ? 'Current' : 'Move in'}
                  </button>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {commercial.length === 0 && <Empty>You do not own any commercial property yet.</Empty>}
    </>
  );
}

/** Trait chips, coloured by whether the trait helps or hurts. */
function TraitChips({ traits }: { traits: string[] }) {
  if (traits.length === 0) return null;
  return (
    <div className="chiprow" style={{ marginTop: 8 }}>
      {traits.map((id) => {
        const t = TRAIT_BY_ID[id];
        if (!t) return null;
        return (
          <Chip key={id} tone={t.tone === 'good' ? 'pos' : t.tone === 'bad' ? 'neg' : 'warn'}>
            {t.name}
          </Chip>
        );
      })}
    </div>
  );
}

/**
 * The shortlist. Three premises, priced by what is wrong and right with them,
 * and the same three until one is bought — so the decision cannot be dodged by
 * closing the sheet and opening it again.
 */
function PremisesSheet({ category, onClose }: { category: CategoryId; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const def = CATEGORY_BY_ID[category];
  const offers = state.premises[category] ?? [];
  const standard = businessCost(state, def);

  return (
    <Modal open onClose={onClose} title={`${def.name} — on the market`}>
      <div className="screen">
        <div className="hint" style={{ marginBottom: 12 }}>
          Three sites, three prices. What is wrong with a place is in the asking
          price, so the cheap one is cheap for a reason and the dear one is not a
          swindle. Whatever you pick, you live with.
        </div>

        {offers.map((offer) => {
          const price = standard * offer.priceMultiplier;
          const affordable = state.cash >= price;
          const traits = offer.traits.map((id) => TRAIT_BY_ID[id]).filter(Boolean);

          return (
            <Card key={offer.id}>
              <div className="row">
                <span style={{ fontWeight: 600 }}>{offer.name}</span>
                <span className="grow" />
                <span className="num faint" style={{ fontSize: 12 }}>
                  {offer.priceMultiplier < 0.97
                    ? `${pct(1 - offer.priceMultiplier, 0)} under`
                    : offer.priceMultiplier > 1.03
                      ? `${pct(offer.priceMultiplier - 1, 0)} over`
                      : 'at asking'}
                </span>
              </div>

              <TraitChips traits={offer.traits} />

              {traits.map((t) => (
                <div key={t.id} className="hint" style={{ marginTop: 6 }}>
                  {t.blurb}
                </div>
              ))}
              {traits.length === 0 && (
                <div className="hint" style={{ marginTop: 6 }}>
                  Nothing remarkable about it in either direction.
                </div>
              )}

              <div className="hint" style={{ marginTop: 8, opacity: 0.55, fontStyle: 'italic' }}>
                {offer.pitch}
              </div>

              <button
                className={`btn btn-block ${affordable ? 'btn-primary' : ''}`}
                style={{ marginTop: 11 }}
                disabled={!affordable}
                onClick={() => {
                  dispatch({ type: 'buyBusiness', category, offerId: offer.id });
                  onClose();
                }}
              >
                {affordable ? `Take it — ${money(price)}` : `Need ${money(price)}`}
              </button>
            </Card>
          );
        })}
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { useGame } from '../../store';
import type { Business } from '../../engine/types';
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
  nextSaturation,
  upgradeCost,
} from '../../engine/selectors';
import { clock, money, rate, pct } from '../../engine/format';
import { Card, Chip, ListRow, Meter, Modal, SectionLabel, Empty } from '../components/common';

export function EmpireScreen() {
  const { state, dispatch } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);

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
              disabled={!unlocked || !affordable}
              onClick={() => dispatch({ type: 'buyBusiness', category: def.id })}
            >
              {!unlocked
                ? `Unlocks at ${money(def.unlockAt)} net worth`
                : `Open for ${money(cost)}`}
            </button>
          </Card>
        );
      })}

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
  const def = CATEGORY_BY_ID[business.category];
  const fin = businessFinancials(state, business);
  const manager = MANAGER_BY_TIER[business.manager];

  return (
    <ListRow onClick={onOpen} label={`${business.name}, level ${business.level}`}>
      <div className="avatar" style={{ borderColor: def.accent + '55' }}>{def.icon}</div>
      <div className="grow">
        <div className="row row-tight">
          <span className="truncate" style={{ fontWeight: 580 }}>{business.name}</span>
          <span className="faint num" style={{ fontSize: 11 }}>Lv{business.level}</span>
        </div>
        <div className="row" style={{ marginTop: 3 }}>
          <span className="faint" style={{ fontSize: 11.5 }}>
            {business.staff}/{maxStaff(business)} staff
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

  const def = CATEGORY_BY_ID[business.category];
  const fin = businessFinancials(state, business);
  const upCost = upgradeCost(state, business);

  return (
    <Modal open onClose={onClose}>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="avatar" style={{ borderColor: def.accent + '55' }}>{def.icon}</div>
        <div className="grow">
          <input
            className="textinput"
            style={{ fontWeight: 640, fontSize: 16, padding: '6px 8px', background: 'transparent', border: 'none' }}
            value={business.name}
            onChange={(e) => dispatch({ type: 'renameBusiness', id: business.id, name: e.target.value })}
          />
          <div className="faint" style={{ fontSize: 12, paddingLeft: 8 }}>
            {def.name} · Level {business.level}
          </div>
        </div>
      </div>

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
          <span className="num dim">{business.staff} / {cap}</span>
        </div>
        <Meter value={cap > 0 ? business.staff / cap : 0} />
        <div className="hint" style={{ marginTop: 8 }}>
          Each hire adds {pct(TUNING.staffRevenueBonus, 0)} revenue and a permanent wage. Upgrade the
          business to raise the cap.
        </div>
        <div className="btn-group" style={{ marginTop: 11 }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={business.staff <= 0}
            onClick={() => dispatch({ type: 'fireStaff', id: business.id })}
          >
            Let one go
          </button>
          <button
            className={`btn btn-sm ${state.cash >= cost && business.staff < cap ? 'btn-primary' : ''}`}
            disabled={state.cash < cost || business.staff >= cap}
            onClick={() => dispatch({ type: 'hireStaff', id: business.id })}
          >
            Hire — {money(cost)}
          </button>
        </div>
      </Card>

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

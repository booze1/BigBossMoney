import { useState } from 'react';
import { useGame } from '../../store';
import { LUXURY_BY_ID, LUXURY_CATEGORIES, LUXURY_ITEMS, FLEX_MILESTONES } from '../../engine/content/luxury';
import { TUNING } from '../../engine/content/tuning';
import { baseFlex, costMultiplier, flexScore, loanRate, luxuryValue, netWorth } from '../../engine/selectors';
import { money, pct, signedPct } from '../../engine/format';
import { Card, Chip, Empty, Meter, SectionLabel, Tile } from '../components/common';

type Tab = 'collection' | (typeof LUXURY_CATEGORIES)[number]['id'];

export function FlexScreen() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<Tab>('collection');

  const flex = flexScore(state);
  const nw = netWorth(state);
  const collectionValue = luxuryValue(state);

  const nextMilestone = FLEX_MILESTONES.find((m) => flex < m.at);
  const prevMilestone = [...FLEX_MILESTONES].reverse().find((m) => flex >= m.at);

  return (
    <div className="screen">
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Flex score" value={flex.toFixed(0)} sub={`${baseFlex(state).toFixed(0)} raw`} />
        <Tile label="Collection" value={money(collectionValue)} sub={`${state.luxury.length} items`} />
        <Tile label="Cash" value={money(state.cash)} />
      </div>

      <Card>
        <div className="card-head">
          <span className="card-title">What Flex buys you</span>
        </div>
        <div className="stack" style={{ fontSize: 13 }}>
          <div className="row">
            <span className="dim">Empire income</span>
            <span className="num pos">+{pct(flex / TUNING.flexIncomeDivisor, 1)}</span>
          </div>
          <div className="row">
            <span className="dim">Luck</span>
            <span className="num pos">+{(flex * TUNING.flexLuckPerPoint).toFixed(0)}</span>
          </div>
          <div className="row">
            <span className="dim">Borrowing rate</span>
            <span className="num">{pct(loanRate(state) * TUNING.secondsPerGameYear, 1)} per year</span>
          </div>
        </div>

        {nextMilestone && (
          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ marginBottom: 5 }}>
              <span className="hint">Next: {nextMilestone.label}</span>
              <span className="num faint" style={{ fontSize: 12 }}>
                {flex.toFixed(0)} / {nextMilestone.at}
              </span>
            </div>
            <Meter
              value={
                prevMilestone
                  ? (flex - prevMilestone.at) / (nextMilestone.at - prevMilestone.at)
                  : flex / nextMilestone.at
              }
              color="var(--legendary)"
            />
            <div className="hint" style={{ marginTop: 6 }}>{nextMilestone.detail}</div>
          </div>
        )}
      </Card>

      <div className="segmented">
        <button
          className={`segment ${tab === 'collection' ? 'active' : ''}`}
          onClick={() => setTab('collection')}
        >
          Mine
        </button>
        {LUXURY_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`segment ${tab === c.id ? 'active' : ''}`}
            onClick={() => setTab(c.id)}
          >
            {c.icon}
          </button>
        ))}
      </div>

      {tab === 'collection' ? (
        state.luxury.length === 0 ? (
          <Empty>
            Nothing in the collection yet. Luxury is not just a trophy here — every item raises your
            Flex, and Flex raises your income, your Luck and your credit.
          </Empty>
        ) : (
          <Card flush>
            {state.luxury.map((owned, i) => {
              const def = LUXURY_BY_ID[owned.itemId];
              if (!def) return null;
              const change = (owned.value - def.price) / def.price;
              return (
                <div key={`${owned.itemId}-${i}`} className="listrow">
                  <div className="avatar">
                    {LUXURY_CATEGORIES.find((c) => c.id === def.category)?.icon}
                  </div>
                  <div className="grow">
                    <div className="truncate" style={{ fontWeight: 570 }}>{def.name}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>
                      {def.brand} · +{def.flex} Flex
                    </div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end' }}>
                    <span className="num" style={{ fontSize: 13 }}>{money(owned.value)}</span>
                    <span className={`num ${change >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 11 }}>
                      {signedPct(change, 1)}
                    </span>
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => dispatch({ type: 'sellLuxury', index: i })}
                  >
                    Sell
                  </button>
                </div>
              );
            })}
          </Card>
        )
      ) : (
        <>
          {LUXURY_ITEMS.filter((i) => i.category === tab).map((item) => {
            const unlocked = nw >= item.unlockAt;
            const price = item.price * costMultiplier(state);
            const affordable = state.cash >= price;
            const ownedCount = state.luxury.filter((o) => o.itemId === item.id).length;

            return (
              <Card key={item.id} className={unlocked ? '' : 'locked'}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="row row-tight">
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      {ownedCount > 0 && <Chip tone="pos">×{ownedCount}</Chip>}
                    </div>
                    <div className="faint" style={{ fontSize: 12 }}>{item.brand}</div>
                    <div className="chiprow" style={{ marginTop: 7 }}>
                      <Chip tone="pos">+{item.flex} Flex</Chip>
                      <Chip tone={item.appreciation >= 0 ? 'pos' : 'neg'}>
                        {signedPct(item.appreciation, 0)} / year
                      </Chip>
                    </div>
                  </div>
                </div>
                <button
                  className={`btn btn-block btn-sm ${affordable && unlocked ? 'btn-primary' : ''}`}
                  style={{ marginTop: 10 }}
                  disabled={!unlocked || !affordable}
                  onClick={() => dispatch({ type: 'buyLuxury', itemId: item.id })}
                >
                  {unlocked ? `Buy — ${money(price)}` : `Unlocks at ${money(item.unlockAt)} net worth`}
                </button>
              </Card>
            );
          })}
        </>
      )}

      {tab === 'collection' && (
        <>
          <SectionLabel>Flex milestones</SectionLabel>
          <Card flush>
            {FLEX_MILESTONES.map((m) => {
              const reached = flex >= m.at;
              return (
                <div key={m.at} className="listrow">
                  <div
                    className="avatar"
                    style={{
                      fontSize: 14,
                      color: reached ? 'var(--pos)' : 'var(--text-faint)',
                      borderColor: reached ? 'var(--pos)' : undefined,
                    }}
                  >
                    {reached ? '✓' : m.at}
                  </div>
                  <div className="grow">
                    <div style={{ fontWeight: 560, fontSize: 13.5, opacity: reached ? 1 : 0.6 }}>
                      {m.label}
                    </div>
                    <div className="hint">{m.detail}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}

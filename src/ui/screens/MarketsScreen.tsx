import { useState } from 'react';
import { useGame } from '../../store';
import type { Asset } from '../../engine/types';
import { marketBoostMultiplier, portfolioCost, portfolioValue } from '../../engine/selectors';
import { money, signedPct } from '../../engine/format';
import { AmountSlider, Card, Chip, Empty, Modal, PriceChart, SectionLabel, Sparkline, Tile } from '../components/common';

export function MarketsScreen() {
  const { state } = useGame();
  const [tab, setTab] = useState<'stocks' | 'crypto' | 'portfolio' | 'news'>('stocks');
  const [openId, setOpenId] = useState<string | null>(null);

  const value = portfolioValue(state);
  const cost = portfolioCost(state);
  const pnl = value - cost;
  const boost = marketBoostMultiplier(state);

  const open = state.assets.find((a) => a.id === openId) ?? null;

  return (
    <div className="screen">
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Portfolio" value={money(value)} />
        <Tile
          label="Unrealised"
          value={money(pnl, { sign: true })}
          sub={cost > 0 ? signedPct(pnl / cost) : '—'}
          tone={pnl >= 0 ? 'pos' : 'neg'}
        />
        <Tile label="Buying power" value={money(state.cash)} />
      </div>

      {boost > 1.001 && (
        <div className="banner banner-brand">
          Trading boost active — realised profits multiplied by ×{boost.toFixed(2)}.
        </div>
      )}

      <div className="segmented">
        {([
          { id: 'stocks', label: 'Stocks' },
          { id: 'crypto', label: 'Crypto' },
          { id: 'portfolio', label: 'Holdings' },
          { id: 'news', label: 'News' },
        ] as const).map((t) => (
          <button key={t.id} className={`segment ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'stocks' || tab === 'crypto') && (
        <Card flush>
          {state.assets
            .filter((a) => a.kind === (tab === 'stocks' ? 'stock' : 'crypto'))
            .map((a) => (
              <AssetRow key={a.id} asset={a} onOpen={() => setOpenId(a.id)} />
            ))}
        </Card>
      )}

      {tab === 'portfolio' && <Holdings onOpen={setOpenId} />}
      {tab === 'news' && <NewsFeed />}

      {open && <AssetDetail asset={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function changePct(asset: Asset): number {
  if (asset.history.length < 2) return 0;
  const first = asset.history[0];
  return first === 0 ? 0 : (asset.price - first) / first;
}

function AssetRow({ asset, onOpen }: { asset: Asset; onOpen: () => void }) {
  const { state } = useGame();
  const change = changePct(asset);
  const holding = state.holdings.find((h) => h.assetId === asset.id);

  return (
    <div className="listrow listrow-tap" onClick={onOpen}>
      <div className="grow">
        <div className="row row-tight">
          <span className="num" style={{ fontWeight: 640, fontSize: 13.5 }}>{asset.ticker}</span>
          {holding && <Chip tone="pos">held</Chip>}
        </div>
        <div className="faint truncate" style={{ fontSize: 11.5 }}>{asset.name}</div>
      </div>

      <Sparkline data={asset.history} width={70} height={26} />

      <div className="col" style={{ alignItems: 'flex-end', flex: 'none', minWidth: 74 }}>
        <span className="num" style={{ fontSize: 13.5, fontWeight: 600 }}>
          {asset.price < 1 ? `$${asset.price.toFixed(4)}` : money(asset.price)}
        </span>
        <span className={`num ${change >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 11.5 }}>
          {signedPct(change)}
        </span>
      </div>
    </div>
  );
}

function Holdings({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useGame();

  if (state.holdings.length === 0) {
    return <Empty>You hold no positions. Buy something and find out what conviction feels like.</Empty>;
  }

  return (
    <Card flush>
      {state.holdings.map((h) => {
        const asset = state.assets.find((a) => a.id === h.assetId);
        if (!asset) return null;
        const value = h.units * asset.price;
        const cost = h.units * h.costBasis;
        const pnl = value - cost;

        return (
          <div key={h.assetId} className="listrow listrow-tap" onClick={() => onOpen(asset.id)}>
            <div className="grow">
              <div className="num" style={{ fontWeight: 620, fontSize: 13.5 }}>{asset.ticker}</div>
              <div className="faint num" style={{ fontSize: 11.5 }}>
                {h.units < 1 ? h.units.toFixed(6) : h.units.toFixed(2)} @ {money(h.costBasis)}
              </div>
            </div>
            <div className="col" style={{ alignItems: 'flex-end' }}>
              <span className="num" style={{ fontSize: 13.5, fontWeight: 600 }}>{money(value)}</span>
              <span className={`num ${pnl >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 11.5 }}>
                {money(pnl, { sign: true })} · {signedPct(cost > 0 ? pnl / cost : 0)}
              </span>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function NewsFeed() {
  const { state } = useGame();
  if (state.news.length === 0) return <Empty>The tape is quiet. Give it a minute.</Empty>;

  return (
    <>
      {state.news.map((n) => (
        <Card key={n.id}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span
              className="log-dot"
              style={{
                background: n.tone === 'good' ? 'var(--pos)' : n.tone === 'bad' ? 'var(--neg)' : 'var(--text-faint)',
                marginTop: 7,
              }}
            />
            <div className="grow">
              <div style={{ fontWeight: 580, fontSize: 13.5 }}>{n.headline}</div>
              <div className="hint" style={{ marginTop: 3 }}>{n.detail}</div>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

function AssetDetail({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const [amount, setAmount] = useState(() => state.cash * 0.25);

  const holding = state.holdings.find((h) => h.assetId === asset.id);
  const value = holding ? holding.units * asset.price : 0;
  const cost = holding ? holding.units * holding.costBasis : 0;
  const pnl = value - cost;
  const change = changePct(asset);

  return (
    <Modal open onClose={onClose}>
      <div className="row" style={{ marginBottom: 4 }}>
        <div>
          <div className="modal-title" style={{ marginBottom: 0 }}>{asset.ticker}</div>
          <div className="faint" style={{ fontSize: 12.5 }}>{asset.name} · {asset.sector}</div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          <span className="num" style={{ fontSize: 20, fontWeight: 660 }}>
            {asset.price < 1 ? `$${asset.price.toFixed(4)}` : money(asset.price)}
          </span>
          <span className={`num ${change >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 13 }}>
            {signedPct(change)}
          </span>
        </div>
      </div>

      <Card style={{ padding: '10px 6px' }}>
        <PriceChart data={asset.history} />
      </Card>

      {holding && (
        <Card>
          <div className="row"><span className="dim">Position</span><span className="num">{holding.units < 1 ? holding.units.toFixed(6) : holding.units.toFixed(2)}</span></div>
          <div className="row" style={{ marginTop: 5 }}><span className="dim">Market value</span><span className="num">{money(value)}</span></div>
          <div className="row" style={{ marginTop: 5 }}>
            <span className="dim">Unrealised P&L</span>
            <span className={`num ${pnl >= 0 ? 'pos' : 'neg'}`}>{money(pnl, { sign: true })}</span>
          </div>
        </Card>
      )}

      <SectionLabel>Buy</SectionLabel>
      <Card>
        <AmountSlider max={state.cash} value={Math.min(amount, state.cash)} onChange={setAmount} label="Spend" />
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 10 }}
          disabled={amount <= 0 || state.cash < amount}
          onClick={() => dispatch({ type: 'buyAsset', assetId: asset.id, cash: Math.min(amount, state.cash) })}
        >
          Buy {money(Math.min(amount, state.cash))} of {asset.ticker}
        </button>
      </Card>

      {holding && (
        <>
          <SectionLabel>Sell</SectionLabel>
          <div className="btn-group">
            {[0.25, 0.5, 1].map((f) => (
              <button
                key={f}
                className={`btn ${f === 1 ? 'btn-neg' : ''}`}
                onClick={() => {
                  dispatch({ type: 'sellAsset', assetId: asset.id, fraction: f });
                  if (f === 1) onClose();
                }}
              >
                {f === 1 ? 'Sell all' : `Sell ${f * 100}%`}
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

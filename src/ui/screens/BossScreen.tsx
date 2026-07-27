import { useState } from 'react';
import { useGame } from '../../store';
import { TIERS, TUNING } from '../../engine/content/tuning';
import { LEGACY_UPGRADES } from '../../engine/content/luck';
import {
  borrowingCapacity,
  businessIncome,
  businessValue,
  canIPO,
  currentTier,
  interestPerSecond,
  legacyLevel,
  loanRate,
  netWorth,
  nextTier,
  portfolioValue,
  projectedLegacyPoints,
  realEstateValue,
  rentIncome,
  tierProgress,
  totalDebt,
  luxuryValue,
} from '../../engine/selectors';
import { clearSave, exportSave, importSave } from '../../engine/save';
import { duration, money, pct } from '../../engine/format';
import { AmountSlider, Card, Empty, Meter, Modal, SectionLabel, Tile } from '../components/common';

type Tab = 'overview' | 'legacy' | 'debt' | 'log' | 'settings';

export function BossScreen() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="screen">
      <div className="segmented">
        {([
          { id: 'overview', label: 'Empire' },
          { id: 'legacy', label: 'Legacy' },
          { id: 'debt', label: 'Debt' },
          { id: 'log', label: 'Log' },
          { id: 'settings', label: 'Settings' },
        ] as const).map((t) => (
          <button key={t.id} className={`segment ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'legacy' && <Legacy />}
      {tab === 'debt' && <Debt />}
      {tab === 'log' && <Log />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}

function Overview() {
  const { state } = useGame();
  const nw = netWorth(state);
  const tier = currentTier(state);
  const next = nextTier(state);

  const bizIncome = businessIncome(state);
  const rent = rentIncome(state);
  const interest = interestPerSecond(state);

  return (
    <>
      <Card>
        <div className="row">
          <div>
            <div className="tile-label">Current rank</div>
            <div style={{ fontSize: 22, fontWeight: 680, letterSpacing: '-0.01em' }}>{tier.name}</div>
            <div className="hint" style={{ marginTop: 2 }}>{tier.blurb}</div>
          </div>
        </div>
        {next && (
          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ marginBottom: 5 }}>
              <span className="hint">Next: {next.name}</span>
              <span className="num faint" style={{ fontSize: 12 }}>{money(next.at)}</span>
            </div>
            <Meter value={tierProgress(state)} />
          </div>
        )}
      </Card>

      <SectionLabel>Balance sheet</SectionLabel>
      <Card>
        <div className="stack" style={{ fontSize: 13 }}>
          <div className="row"><span className="dim">Cash</span><span className="num">{money(state.cash)}</span></div>
          <div className="row"><span className="dim">Businesses</span><span className="num">{money(state.businesses.reduce((sum, b) => sum + businessValue(b), 0))}</span></div>
          <div className="row"><span className="dim">Portfolio</span><span className="num">{money(portfolioValue(state))}</span></div>
          <div className="row"><span className="dim">Real estate</span><span className="num">{money(realEstateValue(state))}</span></div>
          <div className="row"><span className="dim">Possessions</span><span className="num">{money(luxuryValue(state))}</span></div>
          <div className="row"><span className="dim">Debt</span><span className="num neg">{money(-totalDebt(state))}</span></div>
          <div className="divider" />
          <div className="row">
            <span style={{ fontWeight: 620 }}>Net worth</span>
            <span className="num" style={{ fontWeight: 660 }}>{money(nw)}</span>
          </div>
        </div>
      </Card>

      <SectionLabel>Cash flow per second</SectionLabel>
      <Card>
        <div className="stack" style={{ fontSize: 13 }}>
          <div className="row"><span className="dim">Business net</span><span className={`num ${bizIncome >= 0 ? 'pos' : 'neg'}`}>{money(bizIncome, { sign: true })}</span></div>
          <div className="row"><span className="dim">Rent collected</span><span className="num pos">{money(rent, { sign: true })}</span></div>
          <div className="row"><span className="dim">Interest</span><span className="num neg">{money(-interest, { sign: true })}</span></div>
          <div className="divider" />
          <div className="row">
            <span style={{ fontWeight: 620 }}>Total</span>
            <span className={`num ${bizIncome + rent - interest >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 660 }}>
              {money(bizIncome + rent - interest, { sign: true })}/s
            </span>
          </div>
        </div>
      </Card>

      <SectionLabel>Lifetime</SectionLabel>
      <div className="tiles">
        <Tile label="Peak worth" value={money(state.stats.peakNetWorth)} />
        <Tile label="Total earned" value={money(state.stats.totalEarned)} />
        <Tile label="Decisions" value={`${state.stats.eventsResolved}`} />
        <Tile label="Rolls" value={`${state.stats.rollsMade}`} />
        <Tile label="Mythics" value={`${state.stats.mythicsPulled}`} />
        <Tile label="IPOs" value={`${state.stats.ipos}`} />
        <Tile label="Bankruptcies" value={`${state.stats.bankruptcies}`} />
        <Tile label="Played" value={duration(state.stats.playTime)} />
      </div>

      <SectionLabel>Ranks</SectionLabel>
      <Card flush>
        {TIERS.map((t) => {
          const reached = nw >= t.at;
          return (
            <div key={t.id} className="listrow">
              <div
                className="avatar"
                style={{ fontSize: 14, color: reached ? 'var(--pos)' : 'var(--text-faint)' }}
              >
                {reached ? '✓' : '·'}
              </div>
              <div className="grow">
                <div style={{ fontWeight: 570, opacity: reached ? 1 : 0.55 }}>{t.name}</div>
                <div className="hint">{t.blurb}</div>
              </div>
              <span className="num faint" style={{ fontSize: 12 }}>{money(t.at)}</span>
            </div>
          );
        })}
      </Card>
    </>
  );
}

function Legacy() {
  const { state, dispatch } = useGame();
  const [confirmIPO, setConfirmIPO] = useState(false);
  const points = projectedLegacyPoints(state);
  const eligible = canIPO(state);
  const nw = netWorth(state);

  return (
    <>
      <Card>
        <div className="row">
          <div>
            <div className="tile-label">Legacy Points</div>
            <div style={{ fontSize: 28, fontWeight: 700 }} className="num">{state.legacyPoints}</div>
          </div>
          <div className="col" style={{ alignItems: 'flex-end' }}>
            <span className="tile-label">This run would pay</span>
            <span className="num" style={{ fontSize: 18, fontWeight: 640, color: eligible ? 'var(--legendary)' : 'var(--text-faint)' }}>
              +{points}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ marginBottom: 5 }}>
            <span className="hint">IPO threshold</span>
            <span className="num faint" style={{ fontSize: 12 }}>
              {money(nw)} / {money(TUNING.ipoMinNetWorth)}
            </span>
          </div>
          <Meter value={nw / TUNING.ipoMinNetWorth} color="var(--legendary)" />
        </div>

        <button
          className={`btn btn-block ${eligible ? 'btn-primary' : ''}`}
          style={{ marginTop: 12 }}
          disabled={!eligible}
          onClick={() => setConfirmIPO(true)}
        >
          {eligible ? `Go public — bank ${points} Legacy Points` : `Reach ${money(TUNING.ipoMinNetWorth)} to go public`}
        </button>
        <div className="hint" style={{ marginTop: 8 }}>
          Going public ends the run. You lose every business, position and possession, and keep your
          Legacy Points and everything you have bought with them. The next run starts far stronger.
        </div>
      </Card>

      <SectionLabel>Permanent upgrades</SectionLabel>
      {LEGACY_UPGRADES.map((u) => {
        const level = legacyLevel(state, u.id);
        const maxed = level >= u.maxLevel;
        const cost = Math.ceil(u.baseCost * Math.pow(u.costGrowth, level));
        const affordable = state.legacyPoints >= cost;

        return (
          <Card key={u.id}>
            <div className="row">
              <div className="grow">
                <div className="row row-tight">
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  <span className="num faint" style={{ fontSize: 11.5 }}>Lv{level}/{u.maxLevel}</span>
                </div>
                <div className="hint" style={{ marginTop: 2 }}>{u.description}</div>
                {level > 0 && (
                  <div className="num pos" style={{ fontSize: 12, marginTop: 5 }}>
                    Currently: {u.effectLabel(level)}
                  </div>
                )}
              </div>
            </div>
            <button
              className={`btn btn-block btn-sm ${affordable && !maxed ? 'btn-primary' : ''}`}
              style={{ marginTop: 10 }}
              disabled={maxed || !affordable}
              onClick={() => dispatch({ type: 'buyLegacy', id: u.id })}
            >
              {maxed ? 'Maxed' : `${cost} LP → ${u.effectLabel(level + 1)}`}
            </button>
          </Card>
        );
      })}

      <Modal open={confirmIPO} onClose={() => setConfirmIPO(false)} title="Take the company public?">
        <div className="modal-body">
          You will bank <strong style={{ color: 'var(--legendary)' }}>{points} Legacy Points</strong> and
          start over with nothing but your reputation. Every business, share, property and possession
          is gone. Your permanent upgrades stay.
        </div>
        <div className="btn-group">
          <button className="btn btn-ghost" onClick={() => setConfirmIPO(false)}>Not yet</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              dispatch({ type: 'ipo' });
              setConfirmIPO(false);
            }}
          >
            Ring the bell
          </button>
        </div>
      </Modal>
    </>
  );
}

function Debt() {
  const { state, dispatch } = useGame();
  const [amount, setAmount] = useState(0);

  const capacity = borrowingCapacity(state);
  const total = totalDebt(state);
  const interest = interestPerSecond(state);
  const annualRate = loanRate(state) * TUNING.secondsPerGameYear;

  return (
    <>
      {state.bankruptcyWarning && <BankruptcyPanel />}

      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Total debt" value={money(total)} tone={total > 0 ? 'neg' : undefined} />
        <Tile label="Interest" value={`${money(interest)}/s`} tone={interest > 0 ? 'neg' : undefined} />
        <Tile label="Rate" value={pct(annualRate, 1)} sub="per year" />
      </div>

      <Card>
        <div className="card-head">
          <span className="card-title">Borrow</span>
          <span className="num dim">{money(capacity)} available</span>
        </div>
        <AmountSlider max={capacity} value={Math.min(amount, capacity)} onChange={setAmount} label="Borrow" />
        <button
          className={`btn btn-block ${amount > 0 ? 'btn-primary' : ''}`}
          style={{ marginTop: 10 }}
          disabled={amount <= 0 || capacity <= 0}
          onClick={() => {
            dispatch({ type: 'borrow', amount: Math.min(amount, capacity) });
            setAmount(0);
          }}
        >
          Borrow {money(Math.min(amount, capacity))}
        </button>
        <div className="hint" style={{ marginTop: 8 }}>
          Leverage compounds in both directions. Interest accrues every second whether the business
          is working or not — and a higher Flex score gets you a better rate.
        </div>
      </Card>

      <SectionLabel>Outstanding</SectionLabel>
      {state.debt.length === 0 ? (
        <Empty>Debt free. Boring, and extremely safe.</Empty>
      ) : (
        <Card flush>
          {state.debt.map((loan) => (
            <div key={loan.id} className="listrow">
              <div className="grow">
                <div style={{ fontWeight: 570 }}>
                  {loan.id === 'auto' ? 'Emergency credit line' : 'Term loan'}
                </div>
                <div className="faint" style={{ fontSize: 11.5 }}>
                  {pct(loan.rate * TUNING.secondsPerGameYear, 1)} per year
                  {loan.id === 'auto' && ' · repaid automatically from surplus'}
                </div>
              </div>
              <span className="num neg" style={{ fontSize: 13.5 }}>{money(loan.principal)}</span>
              <button
                className="btn btn-sm"
                disabled={state.cash <= 0}
                onClick={() => dispatch({ type: 'repay', loanId: loan.id, amount: Math.min(state.cash, loan.principal) })}
              >
                Repay
              </button>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function BankruptcyPanel() {
  const { state, dispatch } = useGame();
  const [confirm, setConfirm] = useState(false);
  const raw = TUNING.legacyPointsFactor * Math.sqrt(Math.max(0, state.stats.peakNetWorth) / TUNING.legacyPointsReference);
  const points = Math.max(1, Math.floor(raw * TUNING.bankruptcyLegacyRatio));

  return (
    <>
      <div className="banner banner-neg">
        <strong>You are underwater.</strong> Your debts exceed everything you own. Trade your way out,
        or file and start again with a fraction of the Legacy Points an IPO would have paid.
      </div>
      <button className="btn btn-neg btn-block" style={{ marginBottom: 12 }} onClick={() => setConfirm(true)}>
        File for bankruptcy — keep {points} Legacy Points
      </button>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="File for bankruptcy?">
        <div className="modal-body">
          Everything goes. You keep {points} Legacy Points — about a third of what an IPO at your peak
          would have paid — and whatever permanent upgrades you have already bought.
        </div>
        <div className="btn-group">
          <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Keep fighting</button>
          <button
            className="btn btn-neg"
            onClick={() => {
              dispatch({ type: 'bankruptcy' });
              setConfirm(false);
            }}
          >
            File
          </button>
        </div>
      </Modal>
    </>
  );
}

function Log() {
  const { state } = useGame();
  if (state.log.length === 0) return <Empty>Nothing has happened yet.</Empty>;

  return (
    <Card>
      {state.log.map((entry) => (
        <div key={entry.id} className="log-entry">
          <span
            className="log-dot"
            style={{
              background:
                entry.tone === 'good'
                  ? 'var(--pos)'
                  : entry.tone === 'bad'
                    ? 'var(--neg)'
                    : entry.tone === 'epic'
                      ? 'var(--legendary)'
                      : 'var(--text-faint)',
            }}
          />
          <span className="grow" style={{ color: entry.tone === 'epic' ? 'var(--legendary)' : undefined }}>
            {entry.text}
          </span>
        </div>
      ))}
    </Card>
  );
}

function Settings() {
  const { state, dispatch } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);

  const toggles: { key: keyof typeof state.settings; label: string; hint: string }[] = [
    {
      key: 'autoResolveManaged',
      label: 'Managers resolve their own cards',
      hint: 'Off means every card comes to you, even at managed businesses. More decisions, more payoff.',
    },
    {
      key: 'reducedMotion',
      label: 'Reduce motion',
      hint: 'Tones down roll reveals and transitions.',
    },
  ];

  return (
    <>
      <Card>
        {toggles.map((t) => (
          <div key={t.key} style={{ marginBottom: 14 }}>
            <div className="row">
              <span style={{ fontWeight: 560, fontSize: 13.5 }}>{t.label}</span>
              <button
                className={`btn btn-sm ${state.settings[t.key] ? 'btn-pos' : 'btn-ghost'}`}
                onClick={() => dispatch({ type: 'setSetting', key: t.key, value: !state.settings[t.key] })}
              >
                {state.settings[t.key] ? 'On' : 'Off'}
              </button>
            </div>
            <div className="hint" style={{ marginTop: 3 }}>{t.hint}</div>
          </div>
        ))}
      </Card>

      <SectionLabel>Save data</SectionLabel>
      <Card>
        <div className="hint" style={{ marginBottom: 10 }}>
          Your game saves to this browser automatically. Copy the code below to move it elsewhere.
        </div>
        <button
          className="btn btn-block btn-sm"
          onClick={() => {
            navigator.clipboard?.writeText(exportSave(state));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? 'Copied to clipboard' : 'Copy save code'}
        </button>
        <input
          className="textinput"
          style={{ marginTop: 8 }}
          placeholder="Paste a save code to restore"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <button
          className="btn btn-block btn-sm"
          style={{ marginTop: 8 }}
          disabled={!importText.trim()}
          onClick={() => {
            const restored = importSave(importText);
            if (restored) window.location.reload();
          }}
        >
          Restore from code
        </button>
      </Card>

      <SectionLabel>Danger zone</SectionLabel>
      <button className="btn btn-neg btn-block" onClick={() => setConfirmReset(true)}>
        Wipe everything and start over
      </button>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Wipe your save?">
        <div className="modal-body">
          This deletes everything, including Legacy Points and permanent upgrades. There is no undo.
        </div>
        <div className="btn-group">
          <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button
            className="btn btn-neg"
            onClick={() => {
              clearSave();
              window.location.reload();
            }}
          >
            Wipe it
          </button>
        </div>
      </Modal>
    </>
  );
}

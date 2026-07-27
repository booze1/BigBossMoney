import { useEffect, useRef, useState } from 'react';
import { useGame } from './store';
import type { PendingEvent } from './engine/types';
import { RARITY_META, TUNING } from './engine/content/tuning';
import {
  currentTier,
  netWorth,
  nextTier,
  tierProgress,
  totalIncome,
} from './engine/selectors';
import { duration, money, rate } from './engine/format';
import { AnimatedMoney, Modal } from './ui/components/common';
import { EventCardOverlay } from './ui/components/EventCard';
import { EmpireScreen } from './ui/screens/EmpireScreen';
import { MarketsScreen } from './ui/screens/MarketsScreen';
import { EstateScreen } from './ui/screens/EstateScreen';
import { FlexScreen } from './ui/screens/FlexScreen';
import { LuckScreen } from './ui/screens/LuckScreen';
import { BossScreen } from './ui/screens/BossScreen';

type TabId = 'empire' | 'markets' | 'estate' | 'flex' | 'luck';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'empire', label: 'Empire', icon: '🏪' },
  { id: 'markets', label: 'Markets', icon: '📈' },
  { id: 'estate', label: 'Estate', icon: '🏙️' },
  { id: 'flex', label: 'Flex', icon: '💎' },
  { id: 'luck', label: 'Luck', icon: '🎲' },
];

export default function App() {
  const { state } = useGame();
  const [tab, setTab] = useState<TabId>('empire');
  const [bossOpen, setBossOpen] = useState(false);
  // The open card is held as a snapshot rather than looked up in state:
  // resolving it removes it from `pendingEvents`, and the overlay has to stay
  // mounted afterwards to show the player what actually happened.
  const [activeEvent, setActiveEvent] = useState<PendingEvent | null>(null);
  // Cards the player explicitly deferred, so auto-open does not re-present
  // them the moment they are dismissed.
  const deferred = useRef<Set<string>>(new Set());

  // Surface the oldest pending card automatically — the decision is the game,
  // so it should interrupt rather than wait to be found.
  useEffect(() => {
    if (activeEvent || bossOpen) return;
    const next = state.pendingEvents.find((e) => !deferred.current.has(e.uid));
    if (next) setActiveEvent(next);
  }, [state.pendingEvents.length, activeEvent, bossOpen]);

  const closeEvent = (defer: boolean) => {
    if (defer && activeEvent) deferred.current.add(activeEvent.uid);
    setActiveEvent(null);
  };

  return (
    <div className="app">
      <Header onOpenBoss={() => setBossOpen(true)} />

      {tab === 'empire' && <EmpireScreen />}
      {tab === 'markets' && <MarketsScreen />}
      {tab === 'estate' && <EstateScreen />}
      {tab === 'flex' && <FlexScreen />}
      {tab === 'luck' && <LuckScreen />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'luck' && state.rollTokens > 0 && (
              <span className="tab-badge">{state.rollTokens}</span>
            )}
          </button>
        ))}
      </nav>

      <Toasts />
      <RarityFlash />

      {activeEvent && (
        <EventCardOverlay
          event={activeEvent}
          onClose={() => closeEvent(false)}
          onDefer={() => closeEvent(true)}
        />
      )}

      {bossOpen && (
        <div className="modal-backdrop" onClick={() => setBossOpen(false)}>
          <div
            className="modal"
            style={{ padding: 0, maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ padding: '14px 16px 6px' }}>
              <span className="modal-title" style={{ margin: 0 }}>The Boss</span>
              <button className="icon-btn" onClick={() => setBossOpen(false)}>✕</button>
            </div>
            <BossScreen />
          </div>
        </div>
      )}

      <OfflineReport />
      <Intro />
    </div>
  );
}

function Header({ onOpenBoss }: { onOpenBoss: () => void }) {
  const { state } = useGame();
  const nw = netWorth(state);
  const income = totalIncome(state);
  const tier = currentTier(state);
  const next = nextTier(state);
  const pending = state.pendingEvents.length;

  return (
    <header className="header">
      <div className="header-top">
        <div className="grow">
          <div className="header-label">Net worth</div>
          <div className="header-networth">
            <AnimatedMoney value={nw} />
          </div>
          <div className="header-sub">
            <span className="num dim">{money(state.cash)} cash</span>
            <span className={`num ${income >= 0 ? 'pos' : 'neg'}`}>{rate(income)}</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className={`icon-btn ${state.bankruptcyWarning ? 'alert' : ''}`}
            onClick={onOpenBoss}
            aria-label="Boss panel"
          >
            ☰
            {pending > 0 && <span className="icon-badge">{pending}</span>}
          </button>
        </div>
      </div>

      <div className="tier-rail">
        <span className="tier-name">{tier.name}</span>
        <div className="tier-bar">
          <div className="tier-fill" style={{ width: `${tierProgress(state) * 100}%` }} />
        </div>
        <span className="tier-name">{next ? next.name : 'MAX'}</span>
      </div>
    </header>
  );
}

function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>{t.message}</div>
      ))}
    </div>
  );
}

/** Full-screen celebration for Legendary and Mythic outcomes. */
function RarityFlash() {
  const { state, dispatch } = useGame();
  const flash = state.flash;

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => dispatch({ type: 'clearFlash' }), 2600);
    return () => clearTimeout(timer);
  }, [flash?.id, dispatch]);

  if (!flash) return null;
  const color = flash.rarity ? RARITY_META[flash.rarity].color : 'var(--legendary)';

  return (
    <div className="flash" onClick={() => dispatch({ type: 'clearFlash' })}>
      <div style={{ color, position: 'relative' }}>
        {!state.settings.reducedMotion && (
          <>
            <div className="flash-ring" />
            <div className="flash-ring" style={{ animationDelay: '0.35s' }} />
          </>
        )}
        <div className="flash-inner">
          {flash.rarity && (
            <div className="flash-rarity">{RARITY_META[flash.rarity].name}</div>
          )}
          <div className="flash-text" style={{ color: 'var(--text)' }}>{flash.text}</div>
        </div>
      </div>
    </div>
  );
}

function OfflineReport() {
  const { state, dispatch } = useGame();
  const report = state.offlineReport;
  if (!report) return null;

  return (
    <Modal open onClose={() => dispatch({ type: 'clearOfflineReport' })} title="While you were out">
      <div className="modal-body">
        Your empire ran for {duration(report.seconds)} without you, at{' '}
        {Math.round(TUNING.offlineRate * 100)}% of normal output.
        {report.capped && ' You hit your offline cap — raise it with Delegation upgrades and luck rolls.'}
      </div>
      <div style={{ textAlign: 'center', margin: '10px 0 18px' }}>
        <div className="tile-label">Collected</div>
        <div className="num pos" style={{ fontSize: 32, fontWeight: 700 }}>
          {money(report.earned)}
        </div>
      </div>
      <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'clearOfflineReport' })}>
        Back to it
      </button>
    </Modal>
  );
}

function Intro() {
  const { state, dispatch } = useGame();
  if (state.seenIntro) return null;

  return (
    <Modal open onClose={() => dispatch({ type: 'seenIntro' })} title="Big Boss Money" dismissible={false}>
      <div className="modal-body">
        You own one corner store and {money(state.cash)}. Everything else is up to you.
        <br />
        <br />
        Businesses earn every second, even when the app is closed. They will also bring you
        decisions — those cards are where the real money is made or lost, and your{' '}
        <strong style={{ color: 'var(--epic)' }}>Luck</strong> stat quietly improves every one of
        them. Put profit into stocks, crypto and property. Buy things you do not need, because Flex
        raises your Luck, your income and your credit.
        <br />
        <br />
        Reach {money(TUNING.ipoMinNetWorth)} and you can take it all public, cash out, and start
        again permanently stronger.
      </div>
      <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'seenIntro' })}>
        Let's make some money
      </button>
    </Modal>
  );
}

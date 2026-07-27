import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store';
import type { Rarity } from '../../engine/types';
import { RARITY_META, RARITY_ORDER, TUNING } from '../../engine/content/tuning';
import { flexScore, freeRollInterval, rarityOdds, rollCost, totalLuck } from '../../engine/selectors';
import type { RollResult } from '../../engine/rolls';
import { clock, money, pct } from '../../engine/format';
import { Card, Meter, SectionLabel, Tile } from '../components/common';

/** Length of the suspense animation before a roll is revealed, in ms. */
const SPIN_MS = 850;

export function LuckScreen() {
  const { state, dispatch } = useGame();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RollResult | null>(null);
  const [spinRarity, setSpinRarity] = useState<Rarity>('common');
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const luck = totalLuck(state);
  const odds = rarityOdds(luck);
  const cost = rollCost(state);
  const canRoll = state.rollTokens > 0 || state.cash >= cost;

  const doRoll = () => {
    if (spinning || !canRoll) return;
    const outcome = dispatch({ type: 'roll' });
    if (!outcome.roll) return;

    setSpinning(true);
    setResult(null);

    // Cycle rarity labels during the spin for suspense, then settle on the
    // real result. The outcome is already decided — this is pure theatre.
    const interval = window.setInterval(() => {
      setSpinRarity(RARITY_ORDER[Math.floor(Math.random() * RARITY_ORDER.length)]);
    }, 70);
    timers.current.push(interval);

    const done = window.setTimeout(() => {
      clearInterval(interval);
      setSpinning(false);
      setResult(outcome.roll!);
    }, SPIN_MS);
    timers.current.push(done);
  };

  const rarityColor = result ? RARITY_META[result.rarity].color : RARITY_META[spinRarity].color;

  return (
    <div className="screen">
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Luck" value={luck.toFixed(0)} sub={`${flexScore(state).toFixed(0)} Flex feeds this`} />
        <Tile label="Tokens" value={`${state.rollTokens}`} sub={`next in ${clock(state.rollTimer)}`} />
        <Tile label="Rolls made" value={`${state.stats.rollsMade}`} sub={`${state.stats.mythicsPulled} mythic`} />
      </div>

      <div className="roll-stage" style={{ borderColor: result ? rarityColor + '66' : undefined }}>
        {spinning && (
          <div className="roll-spinner" style={{ color: rarityColor }}>
            {RARITY_META[spinRarity].name.toUpperCase()}
          </div>
        )}

        {!spinning && result && (
          <div style={{ textAlign: 'center', padding: '0 20px' }}>
            <div className="roll-result-rarity" style={{ color: rarityColor }}>
              {RARITY_META[result.rarity].name}
            </div>
            <div className="roll-result-label">{result.reward.label}</div>
            <div className="roll-result-flavor">{result.reward.flavor}</div>
            <div className="chiprow" style={{ justifyContent: 'center', marginTop: 10 }}>
              {result.effects.map((e, i) => (
                <span key={i} className="chip chip-pos">{e}</span>
              ))}
            </div>
          </div>
        )}

        {!spinning && !result && (
          <div style={{ textAlign: 'center', padding: '0 24px' }}>
            <div style={{ fontSize: 30 }}>🎲</div>
            <div className="hint" style={{ marginTop: 6 }}>
              Roll for a deal. Higher Luck makes the good tiers genuinely likely instead of
              theoretically possible.
            </div>
          </div>
        )}
      </div>

      <button
        className={`btn btn-hero ${canRoll ? 'btn-primary' : ''}`}
        disabled={!canRoll || spinning}
        onClick={doRoll}
      >
        {spinning
          ? 'Rolling…'
          : state.rollTokens > 0
            ? `Roll — ${state.rollTokens} token${state.rollTokens === 1 ? '' : 's'} left`
            : `Roll — ${money(cost)}`}
      </button>

      <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
        A free token arrives every {clock(freeRollInterval(state))}, up to {TUNING.maxRollTokens}.
      </div>

      <SectionLabel>Your odds right now</SectionLabel>
      <Card>
        <div className="odds-table">
          {RARITY_ORDER.map((r) => {
            const meta = RARITY_META[r];
            const p = odds[r];
            return (
              <React.Fragment key={r}>
                <div style={{ color: meta.color }}>
                  <div className="row" style={{ marginBottom: 3 }}>
                    <span style={{ fontWeight: 560 }}>{meta.name}</span>
                  </div>
                  <div className="odds-bar" style={{ width: `${Math.max(1.5, p * 100)}%` }} />
                </div>
                <span className="num dim" style={{ alignSelf: 'center', fontSize: 12 }}>
                  {p < 0.001 ? `${(p * 100).toFixed(3)}%` : pct(p, p < 0.01 ? 2 : 1)}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      <SectionLabel>Where Luck comes from</SectionLabel>
      <Card>
        <div className="stack" style={{ fontSize: 13 }}>
          <div className="row">
            <span className="dim">Base stat</span>
            <span className="num">{state.luck.toFixed(0)}</span>
          </div>
          <div className="row">
            <span className="dim">Flex ({flexScore(state).toFixed(0)} × {TUNING.flexLuckPerPoint})</span>
            <span className="num">{(flexScore(state) * TUNING.flexLuckPerPoint).toFixed(0)}</span>
          </div>
          <div className="row">
            <span className="dim">Active boosts</span>
            <span className="num">
              {state.boosts.filter((b) => b.kind === 'luck').reduce((s, b) => s + b.power, 0).toFixed(0)}
            </span>
          </div>
          <div className="divider" />
          <div className="row">
            <span style={{ fontWeight: 600 }}>Total Luck</span>
            <span className="num" style={{ fontWeight: 640 }}>{luck.toFixed(0)}</span>
          </div>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>
          Luck also quietly improves the odds on every event card, currently by up to{' '}
          {pct(Math.min(TUNING.maxLuckOddsBonus, luck * TUNING.luckOddsPerPoint), 1)}.
        </div>
        <div style={{ marginTop: 8 }}>
          <Meter
            value={Math.min(1, (luck * TUNING.luckOddsPerPoint) / TUNING.maxLuckOddsBonus)}
            color="var(--epic)"
          />
        </div>
      </Card>
    </div>
  );
}

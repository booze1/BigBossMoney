import { useState } from 'react';
import { useGame } from '../../store';
import type { PendingEvent } from '../../engine/types';
import { EVENT_BY_ID } from '../../engine/content/events';
import { CATEGORY_BY_ID } from '../../engine/content/businesses';
import { effectiveOdds, luckOddsBonus } from '../../engine/events';
import { clock, pct } from '../../engine/format';
import { Modal } from './common';

/**
 * The decision card. This is the primary "playing the game" moment: the player
 * reads a situation at one of their businesses and picks a line, with the Luck
 * stat visibly improving the stated odds.
 */
export function EventCardOverlay({
  event,
  onClose,
  onDefer,
}: {
  event: PendingEvent;
  onClose: () => void;
  /** Leaves the card in the queue instead of consuming it. */
  onDefer: () => void;
}) {
  const { state, dispatch } = useGame();
  const [resolved, setResolved] = useState<{
    success: boolean;
    certain: boolean;
    text: string;
    effects: string[];
  } | null>(null);

  const def = EVENT_BY_ID[event.defId];
  if (!def) return null;

  const business = state.businesses.find((b) => b.id === event.businessId);
  const category = business ? CATEGORY_BY_ID[business.category] : null;
  const luckBonus = luckOddsBonus(state);

  const choose = (index: number) => {
    const result = dispatch({ type: 'resolveEvent', eventUid: event.uid, choiceIndex: index });
    // The reducer already removed the card; hold the modal open to show what
    // happened rather than snapping straight back to the screen behind it.
    const choice = def.choices[index];
    setResolved({
      success: result.tone === 'good',
      // A choice with no downside branch never "succeeds" or "fails" — it just
      // happens, so it should not be reported as a win.
      certain: choice.odds >= 1,
      text: result.tone === 'good' ? choice.good.text : choice.bad.text,
      effects: result.message ? result.message.split(' · ') : [],
    });
  };

  if (resolved) {
    return (
      <Modal open onClose={onClose} dismissible={false}>
        <div
          className="flash-rarity"
          style={{
            color: resolved.certain
              ? 'var(--text-dim)'
              : resolved.success
                ? 'var(--pos)'
                : 'var(--neg)',
            marginBottom: 8,
          }}
        >
          {resolved.certain ? 'Done' : resolved.success ? 'It worked' : 'It did not'}
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 14 }}>{resolved.text}</div>
        {resolved.effects.length > 0 && (
          <div className="chiprow" style={{ marginBottom: 16 }}>
            {resolved.effects.map((e, i) => (
              // Colour each effect by its own sign rather than the overall
              // outcome: a successful call can still carry a real cost.
              <span key={i} className={`chip ${e.trim().startsWith('-') ? 'chip-neg' : 'chip-pos'}`}>
                {e}
              </span>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-block" onClick={onClose}>
          Back to work
        </button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} dismissible={false}>
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="chiprow">
          {category && <span className="chip">{category.icon} {business?.name}</span>}
          {!category && <span className="chip">Empire</span>}
        </div>
        <span className="num faint" style={{ fontSize: 11.5 }}>{clock(event.expiresIn)}</span>
      </div>

      <h2 className="modal-title">{def.title}</h2>
      <div className="modal-body">{def.body}</div>

      {def.choices.map((choice, i) => {
        const odds = effectiveOdds(state, choice.odds);
        const certain = choice.odds >= 1;
        return (
          <button key={i} className="event-choice" onClick={() => choose(i)}>
            <div className="event-choice-label">
              <span>{choice.label}</span>
              <span
                className="odds-pill"
                style={{
                  color: certain ? 'var(--text-dim)' : odds >= 0.75 ? 'var(--pos)' : odds >= 0.5 ? 'var(--warn)' : 'var(--neg)',
                }}
              >
                {certain ? 'CERTAIN' : pct(odds, 0)}
              </span>
            </div>
            <div className="event-choice-hint">{choice.hint}</div>
          </button>
        );
      })}

      {luckBonus > 0.001 && (
        <div className="hint" style={{ textAlign: 'center', marginTop: 6 }}>
          Your Luck is adding {pct(luckBonus, 1)} to every uncertain outcome above.
        </div>
      )}

      <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 10 }} onClick={onDefer}>
        Decide later
      </button>
    </Modal>
  );
}

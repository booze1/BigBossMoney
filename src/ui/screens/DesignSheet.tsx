import { useState } from 'react';
import { useGame } from '../../store';
import type { CustomDesign } from '../../engine/types';
import { CATEGORY_BY_ID } from '../../engine/content/businesses';
import { TRAIT_BY_ID } from '../../engine/content/traits';
import { businessCost, designFee, designsUnlocked } from '../../engine/selectors';
import { traitPriceMultiplier } from '../../engine/premises';
import { netWorth } from '../../engine/selectors';
import { TUNING } from '../../engine/content/tuning';
import { money } from '../../engine/format';
import { Card, Chip, Modal, SectionLabel } from '../components/common';
import { AiError, generateDesign, hasApiKey, refineDesign } from '../../ai/gemini';

/**
 * Describing a business and getting one back.
 *
 * One text box, then a proposal you can take, argue with, or throw away. The
 * argue path matters more than it looks: the first answer is rarely quite
 * right, and "make it seedier" is a far better interface than a form with a
 * seediness slider on it.
 *
 * Every failure lands in the same place — a line of text under the box and the
 * button enabled again. Nothing here can leave the player stuck, because the
 * whole feature is optional and the game behind it is unaffected.
 */

type Stage = 'writing' | 'working' | 'proposal';

const EXAMPLES = [
  'a barbershop that is obviously a front',
  'a funeral home that also does wedding catering — we reuse the flowers',
  'a laundrette open 24 hours where nobody ever seems to do laundry',
  'a family bakery three generations deep and one bad decision from closing',
  'a private members club for people who inherited everything',
];

export function DesignSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useGame();
  const [stage, setStage] = useState<Stage>('writing');
  const [prompt, setPrompt] = useState('');
  const [nudge, setNudge] = useState('');
  const [design, setDesign] = useState<CustomDesign | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keyed = hasApiKey();
  const unlocked = designsUnlocked(state);
  const fee = designFee(state);
  const affordable = state.cash >= fee;

  async function run(work: () => Promise<CustomDesign>) {
    setStage('working');
    setError(null);
    try {
      setDesign(await work());
      setStage('proposal');
    } catch (err) {
      // AiError messages are already written for a player. A DesignError means
      // the model returned something structurally wrong, which is worth saying
      // plainly rather than hiding behind "something went wrong".
      setError(
        err instanceof AiError
          ? err.message
          : err instanceof Error
            ? `That came back malformed — ${err.message}. Try again.`
            : 'Something went wrong. Try again.',
      );
      setStage(design ? 'proposal' : 'writing');
    }
  }

  function accept() {
    if (!design) return;
    dispatch({ type: 'saveDesign', design });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Design a business">
      <div className="screen">
        {!unlocked && <LockedNotice />}
        {unlocked && !keyed && <NoKeyNotice />}

        {stage !== 'proposal' && (
          <>
            <div className="hint" style={{ marginBottom: 10 }}>
              Describe it however you like. It can be anything — the game will work out how it earns
              and write its own event cards around whatever you say.
            </div>
            <div className="hint" style={{ marginBottom: 10 }}>
              Drafting and changing it are free. Putting it on the register costs{' '}
              <span className="num">{money(fee)}</span>
              {state.designs.length > 0 && ' — each company you incorporate costs more than the last'}
              . Opening one after that costs whatever its trade would cost anyone.
            </div>

            <textarea
              className="textinput"
              rows={4}
              maxLength={600}
              placeholder="a barbershop that is obviously a front"
              value={prompt}
              disabled={stage === 'working' || !keyed || !unlocked}
              onChange={(e) => setPrompt(e.target.value)}
              style={{ resize: 'none', fontFamily: 'inherit', fontSize: 14 }}
            />

            <div className="chiprow" style={{ marginTop: 10 }}>
              {EXAMPLES.slice(0, 3).map((ex) => (
                <button
                  key={ex}
                  className="chip"
                  style={{ cursor: 'pointer', textAlign: 'left' }}
                  disabled={stage === 'working' || !keyed || !unlocked}
                  onClick={() => setPrompt(ex)}
                >
                  {ex.length > 34 ? `${ex.slice(0, 34)}…` : ex}
                </button>
              ))}
            </div>

            {error && <div className="hint neg" style={{ marginTop: 10 }}>{error}</div>}

            <button
              className={`btn btn-block ${prompt.trim() && keyed && unlocked ? 'btn-primary' : ''}`}
              style={{ marginTop: 14 }}
              disabled={stage === 'working' || !prompt.trim() || !keyed || !unlocked}
              onClick={() => run(() => generateDesign(prompt))}
            >
              {stage === 'working' ? 'Working on it…' : 'Build it'}
            </button>
          </>
        )}

        {stage === 'proposal' && design && (
          <>
            <DesignPreview design={design} />

            {error && <div className="hint neg" style={{ marginTop: 10 }}>{error}</div>}

            <SectionLabel>Not quite right?</SectionLabel>
            <input
              className="textinput"
              maxLength={300}
              placeholder="make it seedier"
              value={nudge}
              onChange={(e) => setNudge(e.target.value)}
            />
            <button
              className="btn btn-block btn-sm"
              style={{ marginTop: 8 }}
              disabled={!nudge.trim()}
              onClick={() =>
                run(async () => {
                  const next = await refineDesign(design, nudge);
                  setNudge('');
                  return next;
                })
              }
            >
              Change it
            </button>

            <button
              className={`btn btn-block ${affordable ? 'btn-primary' : ''}`}
              style={{ marginTop: 14 }}
              disabled={!affordable}
              onClick={accept}
            >
              {affordable
                ? `Incorporate ${design.name} — ${money(fee)}`
                : `Needs ${money(fee)} to incorporate`}
            </button>
            <button
              className="btn btn-ghost btn-block btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                setDesign(null);
                setError(null);
                setStage('writing');
              }}
            >
              Start again
            </button>
            <div className="hint" style={{ marginTop: 10 }}>
              Incorporating files it on your register for good — it survives going public, and comes
              back with its history every run. Opening a branch costs whatever that trade costs
              anyone.
            </div>
          </>
        )}

        {stage === 'working' && (
          <div className="hint" style={{ marginTop: 14, textAlign: 'center' }}>
            Writing its cards. This takes a few seconds.
          </div>
        )}

        {/* The state above is local, so mention what leaving costs. */}
        {state.designs.length > 0 && stage === 'writing' && (
          <div className="hint" style={{ marginTop: 16 }}>
            You have {state.designs.length} design{state.designs.length === 1 ? '' : 's'} already.
            Close this to open one.
          </div>
        )}
      </div>
    </Modal>
  );
}

function LockedNotice() {
  const { state } = useGame();
  return (
    <Card>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Not yet</div>
      <div className="hint">
        Founding your own company unlocks at {money(TUNING.designUnlockAt)} net worth. You are at{' '}
        {money(netWorth(state))}. Run what you have for a while first — the six trades below teach
        you what a business actually does before you are handed a blank page.
      </div>
    </Card>
  );
}

function NoKeyNotice() {
  return (
    <Card>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Needs a Gemini key</div>
      <div className="hint">
        Designing a business asks Google's Gemini to write it. There is no server behind this game,
        so it uses your own key rather than one hidden in the app — get a free one from Google AI
        Studio and paste it into Settings.
      </div>
      <div className="hint" style={{ marginTop: 8 }}>
        Everything else works without it, and anything you design is saved to your device and keeps
        working offline.
      </div>
    </Card>
  );
}

/** What you are being offered, before you commit money to it. */
export function DesignPreview({ design, compact }: { design: CustomDesign; compact?: boolean }) {
  const { state } = useGame();
  const archetype = CATEGORY_BY_ID[design.archetype];
  const cost = businessCost(state, archetype) * traitPriceMultiplier(design.traits);

  return (
    <Card>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="avatar" style={{ borderColor: archetype.accent + '55' }}>{design.icon}</div>
        <div className="grow">
          <div style={{ fontWeight: 640, fontSize: 16 }}>{design.name}</div>
          <div className="faint" style={{ fontSize: 12.5 }}>{design.tagline}</div>
        </div>
      </div>

      <div className="hint" style={{ marginTop: 10 }}>{design.blurb}</div>

      <div className="chiprow" style={{ marginTop: 10 }}>
        <Chip>Earns like a {archetype.name.toLowerCase()}</Chip>
        {design.traits.map((id) => {
          const t = TRAIT_BY_ID[id];
          return t ? (
            <Chip key={id} tone={t.tone === 'good' ? 'pos' : t.tone === 'bad' ? 'neg' : 'warn'}>
              {t.name}
            </Chip>
          ) : null;
        })}
        <Chip>{design.cards.length} cards</Chip>
      </div>

      <div className="hint" style={{ marginTop: 8 }}>
        Staff: {design.staffRoles.join(' · ')}
      </div>

      {!compact && (
        <>
          <div className="hint" style={{ marginTop: 12, fontWeight: 560 }}>
            {design.cards[0]?.title}
          </div>
          <div className="hint" style={{ marginTop: 4, opacity: 0.75 }}>
            {design.cards[0]?.body}
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <span className="faint" style={{ fontSize: 12 }}>
          {design.runsOpened > 0
            ? `Opened on ${design.runsOpened} run${design.runsOpened === 1 ? '' : 's'}`
            : 'Never opened'}
        </span>
        <span className="grow" />
        <span className="num" style={{ fontSize: 13 }}>{money(cost)}</span>
      </div>
    </Card>
  );
}

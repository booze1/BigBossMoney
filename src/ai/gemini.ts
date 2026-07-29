import type { CustomDesign } from '../engine/types';
import { CATEGORIES } from '../engine/content/businesses';
import { TRAITS } from '../engine/content/traits';
import { DESIGN_LIMITS, DesignError, validateDesign } from '../engine/custom';
import { AiError, callGemini } from './client';
export { AiError } from './client';

export {
  DEFAULT_MODEL,
  getApiKey,
  getModel,
  hasApiKey,
  setApiKey,
  setModel,
} from './client';

/**
 * Turning a sentence into a business.
 *
 * The call itself lives in client.ts; this is the job description — what the
 * model is told, what shape the answer must take, and the refine path that
 * changes one thing about a design without disturbing the rest of it.
 */

/**
 * The model is told exactly which primitives exist, because every one it
 * invents is one the validator will throw away. Listing the traits and
 * archetypes inline costs a few hundred tokens and saves most of the failures.
 */
/**
 * How many cards to ask for. The validator accepts up to sixteen, but asking
 * for the maximum makes a long reply that thinking models frequently run out of
 * room to finish — and a truncated reply is a failed design. Eight is plenty:
 * a design's deck is drawn alongside its archetype's authored cards, not
 * instead of them.
 */
const CARDS_REQUESTED = 8;

function systemPrompt(): string {
  const archetypes = CATEGORIES.map(
    (c) => `  ${c.id} — ${c.name}: ${c.blurb} (margin ${Math.round((1 - c.upkeepRatio) * 100)}%)`,
  ).join('\n');

  const traits = TRAITS.map((t) => `  ${t.id} (${t.tone}) — ${t.name}: ${t.blurb}`).join('\n');

  return `You turn a player's description of a business into content for Big Boss Money, a business empire game with a dry, deadpan tone. Comedy is allowed; whimsy is not. Write like the business is real and the money matters.

Return JSON only, matching the schema exactly.

ARCHETYPE — pick the one whose economics fit best. This decides how the business earns; it is not a genre label, and the player's business does not have to resemble it:
${archetypes}

TRAITS — pick 0 to ${DESIGN_LIMITS.maxTraits} from this list, by id, only if they genuinely fit. Do not invent ids; invented ones are discarded:
${traits}

CARDS — write ${CARDS_REQUESTED} event cards. Each is a specific situation at THIS business that needs a decision, with 2 choices. Rules:
- One choice should be safe and usually costly; one should be a gamble with stated odds.
- odds is the chance the good outcome fires, 0.15 to 1. Use 1 for a choice that always works.
- cashSeconds is the payout in seconds of this business's income: -600 to 600. A routine annoyance is 40-120. A serious problem is 200-350. 500+ is once-a-run.
- morale is -0.15 to 0.15. Use it when the decision is about people.
- Both good and bad outcomes need text. For a choice with odds 1, write the same outcome in both.
- Cards must be specific to this business. "A supplier raises prices" is worthless; write what only this place would face.

STAFF ROLES — ${DESIGN_LIMITS.minRoles} to ${DESIGN_LIMITS.maxRoles} job titles as they would be said out loud: "on the tills", "behind the bar", "in the back". Lowercase, no articles.

Never mention the archetype, the trait ids, or the game's mechanics in any player-facing text.`;
}

/**
 * Matches the fields validateDesign reads.
 *
 * The outcome shape is written out twice rather than referenced through
 * `$defs`. Gemini's `responseSchema` is an OpenAPI subset whose support for
 * `$ref` is inconsistent — Google's own guidance is to use `responseJsonSchema`
 * when a schema needs references — and a rejected schema comes back as a bare
 * 400, which is indistinguishable from a bad key unless you read the message.
 * Duplicating eight lines is a better trade than depending on that.
 */
const OUTCOME_SCHEMA = {
  type: 'object',
  required: ['text'],
  properties: {
    text: { type: 'string', description: 'What happens, in one or two sentences.' },
    cashSeconds: { type: 'number', description: 'Payout in seconds of income, -600 to 600.' },
    morale: { type: 'number', description: 'Change in morale, -0.15 to 0.15.' },
  },
} as const;

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['name', 'tagline', 'blurb', 'archetype', 'traits', 'staffRoles', 'icon', 'cards'],
  properties: {
    name: { type: 'string', description: 'Trading name. No more than 40 characters.' },
    tagline: { type: 'string', description: 'One short line: what the place actually is.' },
    blurb: { type: 'string', description: 'Two sentences, deadpan, about how it operates.' },
    archetype: { type: 'string', enum: CATEGORIES.map((c) => c.id) },
    traits: { type: 'array', items: { type: 'string', enum: TRAITS.map((t) => t.id) } },
    staffRoles: { type: 'array', items: { type: 'string' } },
    icon: { type: 'string', description: 'A single emoji.' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'body', 'choices'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          choices: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'hint', 'odds', 'good', 'bad'],
              properties: {
                label: { type: 'string' },
                hint: { type: 'string', description: 'Three or four words.' },
                odds: { type: 'number' },
                good: OUTCOME_SCHEMA,
                bad: OUTCOME_SCHEMA,
              },
            },
          },
        },
      },
    },
  },
} as const;

const DESIGN_CALL = { get system() { return systemPrompt(); }, schema: RESPONSE_SCHEMA };

// ------------------------------------------------------------------ public

/** Turns a player's description into a design. Throws AiError or DesignError. */
export async function generateDesign(prompt: string, signal?: AbortSignal): Promise<CustomDesign> {
  const clean = prompt.trim().slice(0, 600);
  if (!clean) throw new AiError('Describe the business first.', 'bad-reply');

  const raw = await callGemini(
    DESIGN_CALL,
    `Design this business:\n\n"""${clean}"""\n\nTake it seriously, however it is described.`,
    signal,
  );
  const design = validateDesign(raw);
  design.prompt = clean;
  return design;
}

/**
 * Nudges an existing design in words. The previous design goes back in full so
 * the model changes what was asked and leaves the rest alone, and the id and
 * history are preserved so a refine does not reset a design's run count.
 */
export async function refineDesign(
  design: CustomDesign,
  nudge: string,
  signal?: AbortSignal,
): Promise<CustomDesign> {
  const clean = nudge.trim().slice(0, 300);
  if (!clean) throw new AiError('Say what to change.', 'bad-reply');

  const previous = JSON.stringify({
    name: design.name,
    tagline: design.tagline,
    blurb: design.blurb,
    archetype: design.archetype,
    traits: design.traits,
    staffRoles: design.staffRoles,
    icon: design.icon,
    cards: design.cards.map((c) => ({
      title: c.title,
      body: c.body,
      choices: c.choices.map((ch) => ({
        label: ch.label,
        hint: ch.hint,
        odds: ch.odds,
        good: ch.good,
        bad: ch.bad,
      })),
    })),
  });

  const raw = await callGemini(
    DESIGN_CALL,
    `The player originally asked for:\n"""${design.prompt || design.tagline}"""\n\n` +
      `Here is the current design:\n${previous}\n\n` +
      `Change it as follows, and leave everything else as it is:\n"""${clean}"""`,
    signal,
  );

  const next = validateDesign(raw, design);
  next.prompt = design.prompt;
  return next;
}

export { DesignError };

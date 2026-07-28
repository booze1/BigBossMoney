import type { CustomDesign } from '../engine/types';
import { CATEGORIES } from '../engine/content/businesses';
import { TRAITS } from '../engine/content/traits';
import { DESIGN_LIMITS, DesignError, validateDesign } from '../engine/custom';

/**
 * Gemini, bring-your-own-key.
 *
 * The game is a static site with no server, so there is nowhere to hide a
 * shared API key — anything in the bundle can be read out of it. The player
 * supplies their own, it is held in localStorage on their device, and it is
 * deliberately *not* part of GameState: the save is exportable as a text code
 * and a key must never travel inside one.
 *
 * Everything here is optional. No key, no signal, a refused request or a reply
 * that does not parse all land in the same place — the caller gets an error
 * with something sayable in it and the game carries on exactly as it did
 * before. Generated content is written into the save once and never fetched
 * again, so a design keeps working on a train forever after.
 */

const KEY_STORAGE = 'bigbossmoney.gemini.key';
const MODEL_STORAGE = 'bigbossmoney.gemini.model';

/** Fast and cheap, and on the free tier. Overridable in Settings. */
export const DEFAULT_MODEL = 'gemini-2.5-flash';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 45_000;

// ---------------------------------------------------------------- the key

export function getApiKey(): string | null {
  try {
    const key = localStorage.getItem(KEY_STORAGE);
    return key && key.trim() ? key.trim() : null;
  } catch {
    return null;
  }
}

export function setApiKey(key: string | null): void {
  try {
    if (key && key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* private browsing; the feature is simply unavailable */
  }
}

export function getModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE)?.trim() || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function setModel(model: string | null): void {
  try {
    if (model && model.trim()) localStorage.setItem(MODEL_STORAGE, model.trim());
    else localStorage.removeItem(MODEL_STORAGE);
  } catch {
    /* ignore */
  }
}

export const hasApiKey = (): boolean => getApiKey() !== null;

/**
 * Errors the UI can say out loud. The message is written for a player rather
 * than a developer, because it is going straight onto the screen.
 */
export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: 'no-key' | 'rejected' | 'rate-limit' | 'model' | 'network' | 'bad-reply' | 'blocked',
  ) {
    super(message);
  }
}

// ------------------------------------------------------------------ prompt

/**
 * The model is told exactly which primitives exist, because every one it
 * invents is one the validator will throw away. Listing the traits and
 * archetypes inline costs a few hundred tokens and saves most of the failures.
 */
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

CARDS — write ${DESIGN_LIMITS.minCards} to ${DESIGN_LIMITS.maxCards} event cards. Each is a specific situation at THIS business that needs a decision, with 2 choices. Rules:
- One choice should be safe and usually costly; one should be a gamble with stated odds.
- odds is the chance the good outcome fires, 0.15 to 1. Use 1 for a choice that always works.
- cashSeconds is the payout in seconds of this business's income: -600 to 600. A routine annoyance is 40-120. A serious problem is 200-350. 500+ is once-a-run.
- morale is -0.15 to 0.15. Use it when the decision is about people.
- Both good and bad outcomes need text. For a choice with odds 1, write the same outcome in both.
- Cards must be specific to this business. "A supplier raises prices" is worthless; write what only this place would face.

STAFF ROLES — ${DESIGN_LIMITS.minRoles} to ${DESIGN_LIMITS.maxRoles} job titles as they would be said out loud: "on the tills", "behind the bar", "in the back". Lowercase, no articles.

Never mention the archetype, the trait ids, or the game's mechanics in any player-facing text.`;
}

/** Matches the fields validateDesign reads. Anything else is ignored anyway. */
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
                good: { $ref: '#/$defs/outcome' },
                bad: { $ref: '#/$defs/outcome' },
              },
            },
          },
        },
      },
    },
  },
  $defs: {
    outcome: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string' },
        cashSeconds: { type: 'number' },
        morale: { type: 'number' },
      },
    },
  },
} as const;

// -------------------------------------------------------------------- call

async function callGemini(userPrompt: string, signal?: AbortSignal): Promise<unknown> {
  const key = getApiKey();
  if (!key) throw new AiError('No Gemini key set. Add one in Settings.', 'no-key');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(getModel())}:generateContent`, {
      method: 'POST',
      // The key goes in a header rather than the query string so it does not
      // end up in a URL that could be logged by anything in between.
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 1,
maxOutputTokens: 8192,
        },
      }),
    });
  } catch (err) {
    throw new AiError(
      controller.signal.aborted
        ? 'That took too long. Try again, or try a shorter description.'
        : 'Could not reach Gemini. Check your connection.',
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    // The message is player-facing, so it says what to do rather than what
    // happened. The status is what distinguishes them.
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new AiError('That key was refused. Check it in Settings.', 'rejected');
    }
    if (response.status === 404) {
      throw new AiError(
        `Model "${getModel()}" is not available on your key. Try another in Settings.`,
        'model',
      );
    }
    if (response.status === 429) {
      throw new AiError('Gemini is rate-limiting you. Wait a minute and try again.', 'rate-limit');
    }
    throw new AiError(`Gemini returned an error (${response.status}). ${body.slice(0, 120)}`, 'network');
  }

  const payload = (await response.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  } | null;

  if (payload?.promptFeedback?.blockReason) {
    throw new AiError('Gemini would not answer that one. Try describing it differently.', 'blocked');
  }

  const candidate = payload?.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY') {
    throw new AiError('Gemini would not answer that one. Try describing it differently.', 'blocked');
  }
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new AiError('The reply was cut off. Try a simpler description.', 'bad-reply');
  }

  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new AiError('Gemini sent nothing back. Try again.', 'bad-reply');

  try {
    return JSON.parse(text);
  } catch {
    // responseSchema makes this unlikely, but a truncated or fenced reply is
    // still possible and must not reach the engine as a half-parsed object.
    const fenced = text.match(/\{[\s\S]*\}/);
    if (fenced) {
      try {
        return JSON.parse(fenced[0]);
      } catch {
        /* fall through */
      }
    }
    throw new AiError('Gemini sent something unreadable. Try again.', 'bad-reply');
  }
}

// ------------------------------------------------------------------ public

/** Turns a player's description into a design. Throws AiError or DesignError. */
export async function generateDesign(prompt: string, signal?: AbortSignal): Promise<CustomDesign> {
  const clean = prompt.trim().slice(0, 600);
  if (!clean) throw new AiError('Describe the business first.', 'bad-reply');

  const raw = await callGemini(
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

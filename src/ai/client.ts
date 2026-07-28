/**
 * The one place this app talks to Gemini.
 *
 * Shared by everything that uses the model, because the parts worth getting
 * right — where the key lives, how failure is described to a player, and the
 * refusal to trust a reply — should exist once. Callers supply a system prompt
 * and a response schema and get back parsed JSON they still have to validate.
 *
 * The key is the player's own. This is a static site with no server, so a
 * shared key would have to sit in the bundle where anyone could read it out.
 * It is held in localStorage and deliberately kept out of GameState: the save
 * exports as a copyable code, and a key must never travel inside one.
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

// -------------------------------------------------------------------- call

export interface CallConfig {
  /** The system instruction: the rules for this particular job. */
  system: string;
  /** A JSON schema the reply must match, so it is parseable by construction. */
  schema: unknown;
}

export async function callGemini(
  config: CallConfig,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<unknown> {
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
        systemInstruction: { parts: [{ text: config.system }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: config.schema,
          temperature: 1,
maxOutputTokens: 8192,
        },
      }),
    });
  } catch {
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


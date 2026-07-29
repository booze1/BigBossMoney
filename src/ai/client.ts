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

/**
 * The newest model that is confirmed free-tier eligible, which is what matters
 * for a game that asks players to bring their own key. Pro models left the free
 * tier in April 2026, and whether the very newest Flash releases are free is
 * genuinely unclear from outside — so rather than guess, Settings can ask the
 * key what it actually has (see listModels) and the player picks.
 */
export const DEFAULT_MODEL = 'gemini-3-flash';

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

// ------------------------------------------------------------------ models

export interface ModelOption {
  id: string;
  label: string;
  /** Google's own one-line description, when it gives one. */
  blurb: string;
  /** Output token ceiling, which is what limits how many cards fit in a reply. */
  outputLimit: number;
}

/**
 * Asks the key what it can actually run.
 *
 * Hard-coding a recommendation ages badly: the list moves faster than any
 * default, and what a given key is entitled to varies with billing. So the game
 * asks instead of assuming. Filtered to models that support generateContent,
 * since that is the only thing this app does with one, and sorted newest-looking
 * first so the useful ones are at the top.
 */
export async function listModels(signal?: AbortSignal): Promise<ModelOption[]> {
  const key = getApiKey();
  if (!key) throw new AiError('No Gemini key set. Add one first.', 'no-key');

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?pageSize=200`, {
      headers: { 'x-goog-api-key': key },
      signal,
    });
  } catch {
    throw new AiError('Could not reach Gemini. Check your connection.', 'network');
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new AiError('That key was refused. Check it above.', 'rejected');
    }
    throw new AiError(`Gemini returned an error (${response.status}).`, 'network');
  }

  const payload = (await response.json().catch(() => null)) as {
    models?: {
      name?: string;
      displayName?: string;
      description?: string;
      outputTokenLimit?: number;
      supportedGenerationMethods?: string[];
    }[];
  } | null;

  const models = (payload?.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => {
      const id = (m.name ?? '').replace(/^models\//, '');
      return {
        id,
        label: m.displayName || id,
        blurb: (m.description ?? '').slice(0, 110),
        outputLimit: m.outputTokenLimit ?? 0,
      };
    })
    // Embedding and answering models cannot do this job at all.
    .filter((m) => m.id && !/embedding|aqa|imagen|veo|tts|image|native-audio/.test(m.id))
    // A design needs room for a dozen cards; anything short cannot hold one.
    .filter((m) => m.outputLimit === 0 || m.outputLimit >= 4096);

  if (models.length === 0) throw new AiError('That key has no models this game can use.', 'model');

  // Newest first, by the version number in the id, with previews after stable
  // releases of the same version.
  const version = (id: string) => {
    const match = id.match(/gemini-(\d+)(?:\.(\d+))?/);
    return match ? Number(match[1]) * 100 + Number(match[2] ?? 0) : 0;
  };
  return models.sort((a, b) => {
    const byVersion = version(b.id) - version(a.id);
    if (byVersion !== 0) return byVersion;
    return Number(a.id.includes('preview')) - Number(b.id.includes('preview'));
  });
}

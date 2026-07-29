import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiError,
  DEFAULT_MODEL,
  generateDesign,
  getApiKey,
  hasApiKey,
  refineDesign,
  setApiKey,
  setModel,
} from './gemini';
import { listModels } from './client';
import { validateDesign } from '../engine/custom';
import { exportSave } from '../engine/save';
import { createInitialState } from '../engine/state';

/**
 * The Gemini client, tested against a mocked fetch.
 *
 * A live call was used to confirm the endpoint, verb and header path are right
 * — an unauthenticated POST to the real API reaches Google and comes back
 * 400 INVALID_ARGUMENT "API key not valid", which is the branch this maps to
 * "that key was refused". Everything past authentication is covered here,
 * because it cannot be exercised without somebody's key and quota.
 */

// The test environment is node, which has no localStorage.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});
afterEach(() => vi.unstubAllGlobals());

function reply(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

/** A design payload shaped as the model is asked to return one. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'The Third Chair',
    tagline: "Gents' grooming",
    blurb: 'Two barbers, four chairs, and a queue that never needs a haircut.',
    archetype: 'retail',
    traits: ['backstreet'],
    staffRoles: ['on the chairs', 'on the door'],
    icon: '💈',
    cards: Array.from({ length: 4 }, (_, i) => ({
      title: `Situation ${i}`,
      body: 'Something happens that needs deciding.',
      choices: [
        { label: 'Pay it', hint: 'Costs money', odds: 1, good: { text: 'Done.', cashSeconds: -90 }, bad: { text: 'Done.', cashSeconds: -90 } },
        { label: 'Risk it', hint: 'Might pay', odds: 0.6, good: { text: 'It works.', cashSeconds: 150 }, bad: { text: 'It does not.', cashSeconds: -180 } },
      ],
    })),
    ...overrides,
  };
}

const asText = (body: unknown) =>
  reply({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] });

describe('gemini key handling', () => {
  it('stores and clears a key, trimming whitespace', () => {
    expect(hasApiKey()).toBe(false);
    setApiKey('  AIzaTEST  ');
    expect(getApiKey()).toBe('AIzaTEST');
    expect(hasApiKey()).toBe(true);
    setApiKey(null);
    expect(hasApiKey()).toBe(false);
  });

  it('keeps the key out of the exportable save', () => {
    // The save is a copyable text code. A key travelling inside one would be
    // handed to anyone the player sent it to.
    setApiKey('AIzaSECRET');
    const code = exportSave(createInitialState());
    const json = decodeURIComponent(escape(atob(code)));
    expect(json).not.toContain('AIzaSECRET');
    expect(json).not.toContain('gemini');
  });

  it('survives storage being unavailable instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    });
    expect(() => setApiKey('x')).not.toThrow();
    expect(getApiKey()).toBeNull();
    expect(hasApiKey()).toBe(false);
  });
});

describe('gemini request', () => {
  it('sends the key as a header and never in the URL', async () => {
    setApiKey('AIzaSECRET');
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => asText(payload()));
    vi.stubGlobal('fetch', fetchMock);

    await generateDesign('a barbershop that is obviously a front');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain('AIzaSECRET');
    expect(url).toContain(DEFAULT_MODEL);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaSECRET');
    expect(init.method).toBe('POST');
  });

  it('asks for JSON against a schema, so the reply is parseable by construction', async () => {
    setApiKey('k');
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => asText(payload()));
    vi.stubGlobal('fetch', fetchMock);
    await generateDesign('a barbershop');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.properties.archetype.enum).toContain('retail');
    // The player's words reach the model; the system prompt carries the rules.
    expect(JSON.stringify(body.contents)).toContain('a barbershop');
    expect(body.systemInstruction.parts[0].text).toContain('ARCHETYPE');
  });

  it('honours a custom model name', async () => {
    setApiKey('k');
    setModel('gemini-3-pro');
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => asText(payload()));
    vi.stubGlobal('fetch', fetchMock);
    await generateDesign('a barbershop');
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3-pro');
  });
});

describe('gemini failure modes', () => {
  const cases: [string, () => void, AiError['kind']][] = [
    ['no key at all', () => setApiKey(null), 'no-key'],
    ['a refused key', () => vi.stubGlobal('fetch', async () => reply({ error: {} }, 400)), 'rejected'],
    ['a forbidden key', () => vi.stubGlobal('fetch', async () => reply({ error: {} }, 403)), 'rejected'],
    ['an unknown model', () => vi.stubGlobal('fetch', async () => reply({ error: {} }, 404)), 'model'],
    ['rate limiting', () => vi.stubGlobal('fetch', async () => reply({ error: {} }, 429)), 'rate-limit'],
    ['a server error', () => vi.stubGlobal('fetch', async () => reply({ error: {} }, 500)), 'network'],
    ['no network', () => vi.stubGlobal('fetch', async () => { throw new TypeError('failed'); }), 'network'],
    [
      'a blocked prompt',
      () => vi.stubGlobal('fetch', async () => reply({ promptFeedback: { blockReason: 'SAFETY' } })),
      'blocked',
    ],
    [
      'a truncated reply',
      () => vi.stubGlobal('fetch', async () => reply({ candidates: [{ finishReason: 'MAX_TOKENS' }] })),
      'bad-reply',
    ],
    [
      'an empty reply',
      () => vi.stubGlobal('fetch', async () => reply({ candidates: [{ content: { parts: [{ text: '' }] } }] })),
      'bad-reply',
    ],
    [
      'unreadable text',
      () => vi.stubGlobal('fetch', async () => reply({ candidates: [{ content: { parts: [{ text: 'sorry, I cannot' }] } }] })),
      'bad-reply',
    ],
  ];

  for (const [label, arrange, kind] of cases) {
    it(`reports ${label} in words a player can act on`, async () => {
      setApiKey('k');
      arrange();
      const err = await generateDesign('a barbershop').catch((e) => e);
      expect(err, label).toBeInstanceOf(AiError);
      expect(err.kind, label).toBe(kind);
      // Every message has to be sayable on screen, not a stack trace.
      expect(err.message.length).toBeGreaterThan(10);
      expect(err.message).not.toContain('undefined');
    });
  }

  it('recovers JSON the model wrapped in prose or fences', async () => {
    setApiKey('k');
    vi.stubGlobal('fetch', async () =>
      reply({
        candidates: [
          { content: { parts: [{ text: '```json\n' + JSON.stringify(payload()) + '\n```' }] } },
        ],
      }),
    );
    const design = await generateDesign('a barbershop');
    expect(design.name).toBe('The Third Chair');
  });

  it('refuses to send an empty description', async () => {
    setApiKey('k');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateDesign('   ')).rejects.toBeInstanceOf(AiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('gemini output is never trusted', () => {
  it('runs the reply through the validator before it can reach the game', async () => {
    setApiKey('k');
    // An archetype the engine has no economics for.
    vi.stubGlobal('fetch', async () => asText(payload({ archetype: 'casino' })));
    await expect(generateDesign('a casino')).rejects.toThrow(/archetype/);
  });

  it('keeps what the player typed, for the refine thread', async () => {
    setApiKey('k');
    vi.stubGlobal('fetch', async () => asText(payload()));
    const design = await generateDesign('a barbershop that is obviously a front');
    expect(design.prompt).toBe('a barbershop that is obviously a front');
  });

  it('preserves identity and history across a refine', async () => {
    setApiKey('k');
    vi.stubGlobal('fetch', async () => asText(payload()));
    const original = validateDesign(payload());
    original.runsOpened = 3;
    original.timesOpened = 7;
    original.bestNetWorth = 180_000_000;
    original.prompt = 'a barbershop that is obviously a front';

    const refined = await refineDesign(original, 'make it seedier');

    // A refine must not reset a design's past — it is the same company.
    expect(refined.id).toBe(original.id);
    expect(refined.runsOpened).toBe(3);
    expect(refined.timesOpened).toBe(7);
    expect(refined.bestNetWorth).toBe(180_000_000);
    expect(refined.prompt).toBe(original.prompt);
    expect(refined.createdAt).toBe(original.createdAt);
  });

  it('sends the current design and the nudge when refining', async () => {
    setApiKey('k');
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => asText(payload()));
    vi.stubGlobal('fetch', fetchMock);
    const original = validateDesign(payload());

    await refineDesign(original, 'make it seedier');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const sent = JSON.stringify(body.contents);
    expect(sent).toContain('make it seedier');
    expect(sent).toContain('The Third Chair');
  });
});

describe('asking a key what it can run', () => {
  const modelList = (models: unknown[]) => reply({ models });

  it('keeps only models that can do this job, newest first', async () => {
    setApiKey('k');
    vi.stubGlobal('fetch', async () =>
      modelList([
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3-flash-preview', displayName: 'Preview', outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3-flash', displayName: 'Gemini 3 Flash', outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent'] },
        // None of these can write a business.
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/imagen-4', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-tiny', outputTokenLimit: 256, supportedGenerationMethods: ['generateContent'] },
      ]),
    );

    const found = await listModels();
    expect(found.map((m) => m.id)).toEqual([
      'gemini-3.6-flash',
      'gemini-3-flash',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
    ]);
  });

  it('sends the key as a header, and asks for a full page', async () => {
    setApiKey('AIzaSECRET');
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => modelList([
      { name: 'models/gemini-3-flash', outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent'] },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    await listModels();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain('AIzaSECRET');
    expect(url).toContain('pageSize=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaSECRET');
  });

  it('says so plainly when there is nothing usable, or no key', async () => {
    setApiKey(null);
    await expect(listModels()).rejects.toMatchObject({ kind: 'no-key' });

    setApiKey('k');
    vi.stubGlobal('fetch', async () => modelList([{ name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }]));
    await expect(listModels()).rejects.toMatchObject({ kind: 'model' });

    vi.stubGlobal('fetch', async () => reply({ error: {} }, 403));
    await expect(listModels()).rejects.toMatchObject({ kind: 'rejected' });

    vi.stubGlobal('fetch', async () => { throw new TypeError('offline'); });
    await expect(listModels()).rejects.toMatchObject({ kind: 'network' });
  });

  it('defaults to a model that is free-tier eligible', () => {
    // Pro models left the free tier in April 2026, and this game asks players
    // to bring their own key — so the default has to be one a free key can run.
    expect(DEFAULT_MODEL).toContain('flash');
    expect(DEFAULT_MODEL).not.toContain('pro');
  });
});

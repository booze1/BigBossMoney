import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GameState } from './engine/types';
import { TUNING } from './engine/content/tuning';
import { createRuntime, step } from './engine/sim';
import { apply, type Action, type ActionResult } from './engine/actions';
import { load, save } from './engine/save';
import { hasApiKey } from './ai/client';
import { PRESS_MIN_INTERVAL_MS, generatePress, pressSignature, shouldRefreshPress } from './ai/world';

/**
 * The game runs on a mutable state object stepped by a rAF loop, with React
 * re-rendered on a fixed cadence. Cloning a state this size several times a
 * second would cost far more than it buys, so the store owns one instance and
 * publishes a version counter when it changes.
 */

export interface Toast {
  id: number;
  message: string;
  tone: 'good' | 'bad' | 'neutral';
}

interface GameContextValue {
  state: GameState;
  /** Increments on every published change; used as a render key. */
  version: number;
  dispatch: (action: Action) => ActionResult;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  paused: boolean;
  setPaused: (v: boolean) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

/** How often React is re-rendered from the simulation, in ms. */
const RENDER_INTERVAL_MS = 100;
const SAVE_INTERVAL_MS = 5_000;
/** How often the press queue is checked. The fetch itself is far rarer. */
const PRESS_CHECK_INTERVAL_MS = 60_000;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const stateRef = useRef<GameState | null>(null);
  if (stateRef.current === null) stateRef.current = load();

  const runtimeRef = useRef(createRuntime());
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const toastId = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const pushToast = useCallback((message: string, tone: Toast['tone']) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const dispatch = useCallback(
    (action: Action): ActionResult => {
      const s = stateRef.current!;
      const result = apply(s, action);
      if (result.message) pushToast(result.message, result.tone ?? 'neutral');
      setVersion((v) => v + 1);
      return result;
    },
    [pushToast],
  );

  // ------------------------------------------------------------- main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let sinceRender = 0;
    let sinceSave = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);

      const elapsedMs = now - last;
      last = now;
      const dt = Math.min(TUNING.maxCatchUpSeconds, elapsedMs / 1000);

      if (!pausedRef.current && dt > 0) {
        step(stateRef.current!, dt, runtimeRef.current);
      }

      sinceRender += elapsedMs;
      if (sinceRender >= RENDER_INTERVAL_MS) {
        sinceRender = 0;
        setVersion((v) => v + 1);
      }

      sinceSave += elapsedMs;
      if (sinceSave >= SAVE_INTERVAL_MS) {
        sinceSave = 0;
        save(stateRef.current!);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Persist on the way out so a closed tab never loses more than a few seconds.
  /**
   * Keeps the empire's press stocked.
   *
   * This lives here rather than in the engine on purpose: the engine has no
   * network and must not acquire one — it runs headless in the tuning tools and
   * in the test suite, and a fetch inside the tick would make both impossible.
   * The engine only ever consumes a queue that is already in the save.
   *
   * Everything about it is best-effort. No key, no signal, a refused request or
   * a reply that does not parse all end the same way: the queue stays as it is
   * and the authored templates keep printing. The player is never told, because
   * there is nothing they need to do.
   */
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const tick = async () => {
      const state = stateRef.current!;
      if (cancelled || !hasApiKey()) return;

      const signature = pressSignature(state);
      const stale = signature !== state.press.signature;
      if (!stale && !shouldRefreshPress(state)) return;
      // The interval floor applies even to a stale queue, so a fast-changing
      // empire cannot turn into a burst of calls on somebody's free tier.
      if (Date.now() - state.press.lastFetchAt < PRESS_MIN_INTERVAL_MS) return;

      // Stamped before the request, so a failure still counts against the
      // interval and a persistently broken key does not retry every minute.
      state.press.lastFetchAt = Date.now();
      try {
        const items = await generatePress(state, controller.signal);
        if (cancelled || items.length === 0) return;
        const current = stateRef.current!;
        current.press.queue.push(...items);
        current.press.signature = signature;
      } catch {
        /* the templates carry on */
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), PRESS_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const handler = () => save(stateRef.current!);
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler();
    });
    return () => {
      window.removeEventListener('pagehide', handler);
      window.removeEventListener('beforeunload', handler);
    };
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      state: stateRef.current!,
      version,
      dispatch,
      toasts,
      dismissToast,
      paused,
      setPaused,
    }),
    [version, dispatch, toasts, dismissToast, paused],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside a GameProvider');
  return ctx;
}

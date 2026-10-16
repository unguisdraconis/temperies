import { useCallback, useEffect, useRef, useState } from 'react';

export const IDLE_CHROME_FADE_MS = 30_000;
export const IDLE_EXPLORER_RESET_MS = 120_000;
export const IDLE_RESET_FADE_MS = 450;
export const IDLE_RESET_SETTLE_MS = 50;
export const POINTER_ACTIVITY_THRESHOLD_PX = 12;

export type IdlePhase = 'active' | 'chrome-faded' | 'reset-fading' | 'resetting';

interface IdleResetOptions {
  onReset: (signal: AbortSignal) => Promise<boolean>;
  reducedMotion: boolean;
}

interface IdleResetState {
  autoRotate: boolean;
  phase: IdlePhase;
  registerInteraction: () => void;
}

export function useIdleReset({ onReset, reducedMotion }: IdleResetOptions): IdleResetState {
  const [phase, setPhase] = useState<IdlePhase>('active');
  const [autoRotate, setAutoRotate] = useState(() => !reducedMotion);
  const onResetRef = useRef(onReset);
  const interactionRef = useRef<() => void>(() => undefined);
  onResetRef.current = onReset;

  const registerInteraction = useCallback(() => interactionRef.current(), []);

  useEffect(() => {
    let chromeTimer: number | null = null;
    let resetTimer: number | null = null;
    let commitTimer: number | null = null;
    let settleTimer: number | null = null;
    let pointerAnchor: { x: number; y: number } | null = null;
    let resetController: AbortController | null = null;
    let resetRun = 0;
    let disposed = false;

    const clearTimer = (timer: number | null) => {
      if (timer !== null) window.clearTimeout(timer);
    };
    const clearTimers = () => {
      clearTimer(chromeTimer);
      clearTimer(resetTimer);
      clearTimer(commitTimer);
      clearTimer(settleTimer);
      chromeTimer = null;
      resetTimer = null;
      commitTimer = null;
      settleTimer = null;
    };

    const scheduleIdleTimers = () => {
      chromeTimer = window.setTimeout(() => setPhase('chrome-faded'), IDLE_CHROME_FADE_MS);
      resetTimer = window.setTimeout(beginReset, IDLE_EXPLORER_RESET_MS);
    };

    const finishReset = (run: number, succeeded: boolean) => {
      if (disposed || run !== resetRun) return;
      resetController = null;
      if (succeeded) setAutoRotate(!reducedMotion);
      if (reducedMotion) {
        setPhase('active');
        scheduleIdleTimers();
        return;
      }
      setPhase('resetting');
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        setPhase('active');
        scheduleIdleTimers();
      }, IDLE_RESET_SETTLE_MS);
    };

    const completeReset = () => {
      clearTimers();
      const controller = new AbortController();
      const run = ++resetRun;
      resetController = controller;
      if (!reducedMotion) setPhase('resetting');
      void Promise.resolve().then(() => onResetRef.current(controller.signal)).then(
        (succeeded) => finishReset(run, succeeded),
        () => finishReset(run, false),
      );
    };

    function beginReset() {
      resetTimer = null;
      if (reducedMotion) {
        completeReset();
        return;
      }
      setPhase('reset-fading');
      commitTimer = window.setTimeout(() => {
        commitTimer = null;
        completeReset();
      }, IDLE_RESET_FADE_MS);
    }

    const handleInteraction = () => {
      resetRun += 1;
      resetController?.abort();
      resetController = null;
      clearTimers();
      setAutoRotate(false);
      setPhase('active');
      scheduleIdleTimers();
    };
    interactionRef.current = handleInteraction;

    const handlePointerDown = (event: PointerEvent) => {
      pointerAnchor = { x: event.clientX, y: event.clientY };
      handleInteraction();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerAnchor) {
        pointerAnchor = { x: event.clientX, y: event.clientY };
        return;
      }
      if (Math.hypot(event.clientX - pointerAnchor.x, event.clientY - pointerAnchor.y) < POINTER_ACTIVITY_THRESHOLD_PX) return;
      pointerAnchor = { x: event.clientX, y: event.clientY };
      handleInteraction();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleInteraction();
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: true });
    window.addEventListener('touchstart', handleInteraction, { capture: true, passive: true });
    window.addEventListener('wheel', handleInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', handleInteraction, true);
    document.addEventListener('visibilitychange', handleVisibility);
    scheduleIdleTimers();

    return () => {
      disposed = true;
      resetRun += 1;
      resetController?.abort();
      clearTimers();
      interactionRef.current = () => undefined;
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('touchstart', handleInteraction, true);
      window.removeEventListener('wheel', handleInteraction, true);
      window.removeEventListener('keydown', handleInteraction, true);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [reducedMotion]);

  return { autoRotate: autoRotate && !reducedMotion, phase, registerInteraction };
}

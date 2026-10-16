import { useCallback, useEffect, useRef, useState } from 'react';

export const IDLE_CHROME_FADE_MS = 30_000;
export const IDLE_EXPLORER_RESET_MS = 120_000;
export const IDLE_RESET_FADE_MS = 450;
export const IDLE_RESET_SETTLE_MS = 50;
export const POINTER_ACTIVITY_THRESHOLD_PX = 12;

export type IdlePhase = 'active' | 'chrome-faded' | 'reset-fading' | 'resetting';

interface IdleResetOptions {
  onReset: () => void;
  reducedMotion: boolean;
}

interface IdleResetState {
  autoRotate: boolean;
  phase: IdlePhase;
  registerInteraction: () => void;
  resetEpoch: number;
}

export function useIdleReset({ onReset, reducedMotion }: IdleResetOptions): IdleResetState {
  const [phase, setPhase] = useState<IdlePhase>('active');
  const [resetEpoch, setResetEpoch] = useState(0);
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

    const completeReset = () => {
      clearTimers();
      onResetRef.current();
      setResetEpoch((value) => value + 1);
      setAutoRotate(!reducedMotion);
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

  return { autoRotate: autoRotate && !reducedMotion, phase, registerInteraction, resetEpoch };
}

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDLE_CHROME_FADE_MS,
  IDLE_EXPLORER_RESET_MS,
  IDLE_RESET_FADE_MS,
  IDLE_RESET_SETTLE_MS,
  useIdleReset,
} from './useIdleReset';

function Harness({ onReset, reducedMotion = false }: { onReset: (signal: AbortSignal) => Promise<boolean>; reducedMotion?: boolean }) {
  const idle = useIdleReset({ onReset, reducedMotion });
  return <output data-testid="idle" data-auto-rotate={idle.autoRotate}>{idle.phase}</output>;
}

describe('unattended display lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts auto-rotation, fades chrome, resets, and resumes auto-rotation', async () => {
    const onReset = vi.fn(() => Promise.resolve(true));
    render(<Harness onReset={onReset} />);
    const state = screen.getByTestId('idle');
    expect(state).toHaveAttribute('data-auto-rotate', 'true');

    void act(() => { vi.advanceTimersByTime(IDLE_CHROME_FADE_MS); });
    expect(state).toHaveTextContent('chrome-faded');
    void act(() => { vi.advanceTimersByTime(IDLE_EXPLORER_RESET_MS - IDLE_CHROME_FADE_MS); });
    expect(state).toHaveTextContent('reset-fading');
    expect(onReset).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(IDLE_RESET_FADE_MS); await Promise.resolve(); });
    expect(onReset).toHaveBeenCalledOnce();
    expect(state).toHaveAttribute('data-auto-rotate', 'true');
    expect(state).toHaveTextContent('resetting');
    void act(() => { vi.advanceTimersByTime(IDLE_RESET_SETTLE_MS); });
    expect(state).toHaveTextContent('active');
  });

  it('stops rotation on interaction and cancels a pending reset fade', () => {
    const onReset = vi.fn(() => Promise.resolve(true));
    render(<Harness onReset={onReset} />);
    const state = screen.getByTestId('idle');
    fireEvent.pointerDown(window, { clientX: 20, clientY: 20 });
    expect(state).toHaveAttribute('data-auto-rotate', 'false');

    void act(() => { vi.advanceTimersByTime(IDLE_EXPLORER_RESET_MS); });
    expect(state).toHaveTextContent('reset-fading');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(state).toHaveTextContent('active');
    void act(() => { vi.advanceTimersByTime(IDLE_RESET_FADE_MS); });
    expect(onReset).not.toHaveBeenCalled();
  });

  it('ignores incidental pointer jitter but treats deliberate movement as activity', () => {
    render(<Harness onReset={vi.fn(() => Promise.resolve(true))} />);
    const state = screen.getByTestId('idle');
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 15, clientY: 15 });
    expect(state).toHaveAttribute('data-auto-rotate', 'true');
    fireEvent.pointerMove(window, { clientX: 30, clientY: 30 });
    expect(state).toHaveAttribute('data-auto-rotate', 'false');
  });

  it('commits the reset immediately and never rotates when reduced motion is requested', async () => {
    const onReset = vi.fn(() => Promise.resolve(true));
    render(<Harness onReset={onReset} reducedMotion />);
    const state = screen.getByTestId('idle');
    expect(state).toHaveAttribute('data-auto-rotate', 'false');
    await act(async () => { vi.advanceTimersByTime(IDLE_EXPLORER_RESET_MS); await Promise.resolve(); });
    expect(onReset).toHaveBeenCalledOnce();
    expect(state).toHaveTextContent('active');
    expect(state).toHaveAttribute('data-auto-rotate', 'false');
  });

  it('stays hidden until an asynchronous reset succeeds', async () => {
    let resolveReset!: (succeeded: boolean) => void;
    const onReset = vi.fn(() => new Promise<boolean>((resolve) => { resolveReset = resolve; }));
    render(<Harness onReset={onReset} />);
    const state = screen.getByTestId('idle');

    void act(() => { vi.advanceTimersByTime(IDLE_EXPLORER_RESET_MS); });
    await act(async () => { vi.advanceTimersByTime(IDLE_RESET_FADE_MS); await Promise.resolve(); });
    expect(state).toHaveTextContent('resetting');
    void act(() => { vi.advanceTimersByTime(IDLE_RESET_SETTLE_MS * 4); });
    expect(state).toHaveTextContent('resetting');

    await act(async () => { resolveReset(true); await Promise.resolve(); });
    expect(state).toHaveTextContent('resetting');
    void act(() => { vi.advanceTimersByTime(IDLE_RESET_SETTLE_MS); });
    expect(state).toHaveTextContent('active');
    expect(state).toHaveAttribute('data-auto-rotate', 'true');
  });

  it('keeps auto-rotation stopped when reset fails', async () => {
    const onReset = vi.fn(() => Promise.resolve(false));
    render(<Harness onReset={onReset} />);
    const state = screen.getByTestId('idle');
    fireEvent.pointerDown(window, { clientX: 20, clientY: 20 });
    expect(state).toHaveAttribute('data-auto-rotate', 'false');

    void act(() => { vi.advanceTimersByTime(IDLE_EXPLORER_RESET_MS); });
    await act(async () => { vi.advanceTimersByTime(IDLE_RESET_FADE_MS); await Promise.resolve(); });
    void act(() => { vi.advanceTimersByTime(IDLE_RESET_SETTLE_MS); });
    expect(state).toHaveTextContent('active');
    expect(state).toHaveAttribute('data-auto-rotate', 'false');
  });

  it('aborts an in-flight reset when the user returns and ignores its late success', async () => {
    let resolveReset!: (succeeded: boolean) => void;
    let resetSignal!: AbortSignal;
    const onReset = vi.fn((signal: AbortSignal) => {
      resetSignal = signal;
      return new Promise<boolean>((resolve) => { resolveReset = resolve; });
    });
    render(<Harness onReset={onReset} />);
    const state = screen.getByTestId('idle');

    void act(() => { vi.advanceTimersByTime(IDLE_EXPLORER_RESET_MS); });
    await act(async () => { vi.advanceTimersByTime(IDLE_RESET_FADE_MS); await Promise.resolve(); });
    expect(state).toHaveTextContent('resetting');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(resetSignal.aborted).toBe(true);
    expect(state).toHaveTextContent('active');
    expect(state).toHaveAttribute('data-auto-rotate', 'false');

    await act(async () => { resolveReset(true); await Promise.resolve(); });
    void act(() => { vi.advanceTimersByTime(IDLE_RESET_SETTLE_MS); });
    expect(state).toHaveTextContent('active');
    expect(state).toHaveAttribute('data-auto-rotate', 'false');
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDLE_CHROME_FADE_MS,
  IDLE_EXPLORER_RESET_MS,
  IDLE_RESET_FADE_MS,
  IDLE_RESET_SETTLE_MS,
  useIdleReset,
} from './useIdleReset';

function Harness({ onReset, reducedMotion = false }: { onReset: () => void; reducedMotion?: boolean }) {
  const idle = useIdleReset({ onReset, reducedMotion });
  return <output data-testid="idle" data-auto-rotate={idle.autoRotate} data-epoch={idle.resetEpoch}>{idle.phase}</output>;
}

describe('unattended display lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts auto-rotation, fades chrome, resets, and resumes auto-rotation', () => {
    const onReset = vi.fn();
    render(<Harness onReset={onReset} />);
    const state = screen.getByTestId('idle');
    expect(state).toHaveAttribute('data-auto-rotate', 'true');

    void act(() => { vi.advanceTimersByTime(IDLE_CHROME_FADE_MS); });
    expect(state).toHaveTextContent('chrome-faded');
    void act(() => { vi.advanceTimersByTime(IDLE_EXPLORER_RESET_MS - IDLE_CHROME_FADE_MS); });
    expect(state).toHaveTextContent('reset-fading');
    expect(onReset).not.toHaveBeenCalled();

    void act(() => { vi.advanceTimersByTime(IDLE_RESET_FADE_MS); });
    expect(onReset).toHaveBeenCalledOnce();
    expect(state).toHaveAttribute('data-epoch', '1');
    expect(state).toHaveAttribute('data-auto-rotate', 'true');
    expect(state).toHaveTextContent('resetting');
    void act(() => { vi.advanceTimersByTime(IDLE_RESET_SETTLE_MS); });
    expect(state).toHaveTextContent('active');
  });

  it('stops rotation on interaction and cancels a pending reset fade', () => {
    const onReset = vi.fn();
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
    render(<Harness onReset={vi.fn()} />);
    const state = screen.getByTestId('idle');
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 15, clientY: 15 });
    expect(state).toHaveAttribute('data-auto-rotate', 'true');
    fireEvent.pointerMove(window, { clientX: 30, clientY: 30 });
    expect(state).toHaveAttribute('data-auto-rotate', 'false');
  });

  it('commits the reset immediately and never rotates when reduced motion is requested', () => {
    const onReset = vi.fn();
    render(<Harness onReset={onReset} reducedMotion />);
    const state = screen.getByTestId('idle');
    expect(state).toHaveAttribute('data-auto-rotate', 'false');
    void act(() => { vi.advanceTimersByTime(IDLE_EXPLORER_RESET_MS); });
    expect(onReset).toHaveBeenCalledOnce();
    expect(state).toHaveTextContent('active');
    expect(state).toHaveAttribute('data-epoch', '1');
  });
});

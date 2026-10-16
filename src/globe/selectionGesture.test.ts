import { describe, expect, it } from 'vitest';
import {
  PROJECTION_PICK_EPSILON,
  projectionAllowsSelection,
  SELECTION_TAP_SLOP_PX,
  SelectionGestureGuard,
  type PointerGestureSample,
} from './selectionGesture';

function pointer(pointerId: number, clientX: number, clientY: number, overrides: Partial<PointerGestureSample> = {}): PointerGestureSample {
  return { pointerId, clientX, clientY, button: 0, isPrimary: pointerId === 1, ...overrides };
}

describe('selection gesture guard', () => {
  it('accepts a primary tap once and retains an endpoint-distance backstop', () => {
    const guard = new SelectionGestureGuard();
    guard.pointerDown(pointer(1, 20, 30)); guard.pointerUp(pointer(1, 23, 34));
    expect(guard.consumeClick(5)).toBe(true);
    expect(guard.consumeClick(5)).toBe(false);

    guard.pointerDown(pointer(1, 20, 30)); guard.pointerUp(pointer(1, 20, 30));
    expect(guard.consumeClick(SELECTION_TAP_SLOP_PX + 1)).toBe(false);
  });

  it('rejects a drag even when it returns to its starting point', () => {
    const guard = new SelectionGestureGuard();
    guard.pointerDown(pointer(1, 20, 30));
    guard.pointerMove(pointer(1, 60, 70));
    guard.pointerMove(pointer(1, 20, 30));
    guard.pointerUp(pointer(1, 20, 30));
    expect(guard.consumeClick(0)).toBe(false);
  });

  it('applies the movement threshold to travel first observed on pointer up', () => {
    const guard = new SelectionGestureGuard();
    guard.pointerDown(pointer(1, 20, 30)); guard.pointerUp(pointer(1, 20 + SELECTION_TAP_SLOP_PX, 30));
    expect(guard.consumeClick(SELECTION_TAP_SLOP_PX)).toBe(true);

    guard.pointerDown(pointer(1, 20, 30)); guard.pointerUp(pointer(1, 20 + SELECTION_TAP_SLOP_PX + 0.01, 30));
    expect(guard.consumeClick(SELECTION_TAP_SLOP_PX)).toBe(false);
  });

  it('rejects multi-pointer and canceled gestures, then recovers for the next tap', () => {
    const guard = new SelectionGestureGuard();
    guard.pointerDown(pointer(1, 20, 30)); guard.pointerDown(pointer(2, 24, 34));
    guard.pointerUp(pointer(2, 24, 34)); guard.pointerUp(pointer(1, 20, 30));
    expect(guard.consumeClick(0)).toBe(false);

    guard.pointerDown(pointer(1, 20, 30)); guard.pointerCancel();
    expect(guard.consumeClick(0)).toBe(false);

    guard.pointerDown(pointer(1, 20, 30)); guard.pointerUp(pointer(1, 20, 30));
    expect(guard.consumeClick(0)).toBe(true);
  });

  it('clears an active pointer that leaves the canvas and recovers for the next tap', () => {
    const guard = new SelectionGestureGuard();
    guard.pointerDown(pointer(1, 20, 30));
    guard.pointerLost(1);
    expect(guard.consumeClick(0)).toBe(false);

    guard.pointerDown(pointer(1, 20, 30)); guard.pointerUp(pointer(1, 20, 30));
    expect(guard.consumeClick(0)).toBe(true);
  });

  it('does not invalidate a completed tap when capture is released after pointer up', () => {
    const guard = new SelectionGestureGuard();
    guard.pointerDown(pointer(1, 20, 30)); guard.pointerUp(pointer(1, 20, 30));
    guard.pointerLost(1);
    expect(guard.consumeClick(0)).toBe(true);
  });

  it('rejects non-primary and non-left-button activation', () => {
    const guard = new SelectionGestureGuard();
    guard.pointerDown(pointer(2, 20, 30)); guard.pointerUp(pointer(2, 20, 30));
    expect(guard.consumeClick(0)).toBe(false);

    guard.pointerDown(pointer(1, 20, 30, { button: 2 })); guard.pointerUp(pointer(1, 20, 30, { button: 2 }));
    expect(guard.consumeClick(0)).toBe(false);
  });
});

describe('projection selection ownership', () => {
  it('accepts only the active surface at a settled projection endpoint', () => {
    expect(projectionAllowsSelection('globe', 'globe', 0)).toBe(true);
    expect(projectionAllowsSelection('globe', 'globe', PROJECTION_PICK_EPSILON)).toBe(true);
    expect(projectionAllowsSelection('globe', 'globe', PROJECTION_PICK_EPSILON + 0.0001)).toBe(false);
    expect(projectionAllowsSelection('map', 'globe', 0)).toBe(false);

    expect(projectionAllowsSelection('map', 'map', 1)).toBe(true);
    expect(projectionAllowsSelection('map', 'map', 1 - PROJECTION_PICK_EPSILON)).toBe(true);
    expect(projectionAllowsSelection('map', 'map', 1 - PROJECTION_PICK_EPSILON - 0.0001)).toBe(false);
    expect(projectionAllowsSelection('globe', 'map', 1)).toBe(false);
  });
});

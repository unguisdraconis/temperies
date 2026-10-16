import type { ProjectionMode } from '../climate/types';

export const SELECTION_TAP_SLOP_PX = 6;
export const PROJECTION_PICK_EPSILON = 0.001;

export interface PointerGestureSample {
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
  isPrimary: boolean;
}

export function projectionAllowsSelection(surface: ProjectionMode, mode: ProjectionMode, mix: number): boolean {
  if (surface !== mode) return false;
  return surface === 'globe'
    ? mix <= PROJECTION_PICK_EPSILON
    : mix >= 1 - PROJECTION_PICK_EPSILON;
}

export class SelectionGestureGuard {
  private readonly activePointers = new Set<number>();
  private primaryPointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private invalid = true;
  private completedTap: boolean | null = null;

  constructor(private readonly movementTolerance = SELECTION_TAP_SLOP_PX) {}

  pointerDown(event: PointerGestureSample): void {
    if (this.activePointers.has(event.pointerId)) return;
    if (this.activePointers.size === 0) {
      this.primaryPointerId = event.pointerId;
      this.startX = event.clientX;
      this.startY = event.clientY;
      this.invalid = !event.isPrimary || event.button !== 0;
      this.completedTap = null;
    } else {
      this.invalid = true;
    }
    this.activePointers.add(event.pointerId);
    if (this.activePointers.size > 1) this.invalid = true;
  }

  pointerMove(event: PointerGestureSample): void {
    if (!this.activePointers.has(event.pointerId) || event.pointerId !== this.primaryPointerId) return;
    const distanceSquared = (event.clientX - this.startX) ** 2 + (event.clientY - this.startY) ** 2;
    if (distanceSquared > this.movementTolerance ** 2) this.invalid = true;
  }

  pointerUp(event: PointerGestureSample): void {
    if (!this.activePointers.has(event.pointerId)) {
      this.completedTap = false;
      return;
    }
    this.pointerMove(event);
    this.activePointers.delete(event.pointerId);
    if (event.pointerId === this.primaryPointerId) {
      this.completedTap = !this.invalid && this.activePointers.size === 0;
    }
    if (this.activePointers.size === 0) this.primaryPointerId = null;
  }

  pointerCancel(): void {
    this.activePointers.clear();
    this.primaryPointerId = null;
    this.invalid = true;
    this.completedTap = false;
  }

  pointerLost(pointerId: number): void {
    if (this.activePointers.has(pointerId)) this.pointerCancel();
  }

  consumeClick(endpointTravel = 0): boolean {
    const accepted = this.completedTap === true && endpointTravel <= this.movementTolerance;
    this.completedTap = null;
    return accepted;
  }
}

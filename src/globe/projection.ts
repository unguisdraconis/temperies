import * as THREE from 'three';
import type { ProjectionMode } from '../climate/types';

export const PROJECTION_TRANSITION_SECONDS = 1.05;
export const GLOBE_INITIAL_ROTATION = { x: 0.03, y: -0.36 } as const;

export interface ProjectionMixRef { current: number }

export function projectionTarget(mode: ProjectionMode): number {
  return mode === 'map' ? 1 : 0;
}

export function advanceProjectionMix(current: number, target: number, deltaSeconds: number, reducedMotion: boolean): number {
  if (reducedMotion) return target;
  const distance = deltaSeconds / PROJECTION_TRANSITION_SECONDS;
  return current < target ? Math.min(target, current + distance) : Math.max(target, current - distance);
}

export function easeProjectionMix(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

export function plateCarreePosition(u: number, v: number, scale = 1, elevation = 0): THREE.Vector3 {
  return new THREE.Vector3((u * 2 - 1) * scale, (v - 0.5) * scale, elevation);
}

export function createProjectionGeometry(widthSegments = 192, heightSegments = 96): THREE.SphereGeometry {
  const columns = Math.max(3, Math.floor(widthSegments));
  const rows = Math.max(2, Math.floor(heightSegments));
  const geometry = new THREE.SphereGeometry(1, columns, rows);
  const uv = new Float32Array((columns + 1) * (rows + 1) * 2);
  let offset = 0;
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      uv[offset++] = column / columns;
      uv[offset++] = 1 - row / rows;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  // SphereGeometry omits one degenerate triangle per polar cell. Those gaps
  // become visible when the duplicated pole vertices unfold into a map, so use
  // the complete rectangular topology for every latitude band instead.
  const indices: number[] = [];
  const rowStride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const topLeft = row * rowStride + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + rowStride;
      const bottomRight = bottomLeft + 1;
      indices.push(topRight, topLeft, bottomRight, topLeft, bottomLeft, bottomRight);
    }
  }
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(1, 0.5));
  return geometry;
}

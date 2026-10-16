import { describe, expect, it } from 'vitest';
import type { MultiLineString } from 'geojson';
import { createLineGeometry } from './vectorGeometry';

describe('projected vector geometry', () => {
  it('stores aligned sphere and Plate Carrée positions', () => {
    const source = { type: 'MultiLineString', coordinates: [[[0, 0], [90, 45]]] } satisfies MultiLineString;
    const geometry = createLineGeometry(source, 1.01);
    expect(geometry.getAttribute('position').count).toBe(2);
    expect(geometry.getAttribute('mapPosition').count).toBe(2);
    const map = geometry.getAttribute('mapPosition');
    expect([map.getX(0), map.getY(0)]).toEqual([0, 0]);
    expect(map.getX(1)).toBeCloseTo(0.5); expect(map.getY(1)).toBeCloseTo(0.25);
    expect(map.getZ(0)).toBeCloseTo(0.01); expect(map.getZ(1)).toBeCloseTo(0.01);
    expect(geometry.boundingSphere?.radius).toBeCloseTo(Math.hypot(1, 0.5, 0.01));
    geometry.dispose();
  });
  it('does not draw a world-spanning line across the Plate Carrée seam', () => {
    const source = { type: 'MultiLineString', coordinates: [[[170, 0], [-170, 0]], [[0, 0], [10, 0]]] } satisfies MultiLineString;
    const geometry = createLineGeometry(source, 1.01);
    expect(geometry.getAttribute('position').count).toBe(2);
    geometry.dispose();
  });
});

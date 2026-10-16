import { describe, expect, it } from 'vitest';
import { advanceProjectionMix, createProjectionGeometry, easeProjectionMix, plateCarreePosition, projectionTarget } from './projection';

describe('globe to Plate Carrée projection', () => {
  it('maps the canonical UV rectangle to a two-to-one plane', () => {
    expect(plateCarreePosition(0, 0).toArray()).toEqual([-1, -0.5, 0]);
    expect(plateCarreePosition(0.5, 0.5).toArray()).toEqual([0, 0, 0]);
    expect(plateCarreePosition(1, 1).toArray()).toEqual([1, 0.5, 0]);
  });
  it('uses exact canonical UV endpoints on the morphable sphere geometry', () => {
    const geometry = createProjectionGeometry(4, 2);
    const uv = geometry.getAttribute('uv');
    expect([uv.getX(0), uv.getY(0)]).toEqual([0, 1]);
    expect([uv.getX(uv.count - 1), uv.getY(uv.count - 1)]).toEqual([1, 0]);
    geometry.dispose();
  });
  it('covers the complete map rectangle, including both polar rows', () => {
    const widthSegments = 4; const heightSegments = 3;
    const geometry = createProjectionGeometry(widthSegments, heightSegments);
    const uv = geometry.getAttribute('uv'); const index = geometry.getIndex();
    expect(index).not.toBeNull();
    expect(index!.count).toBe(widthSegments * heightSegments * 6);

    let twiceArea = 0;
    for (let offset = 0; offset < index!.count; offset += 3) {
      const a = index!.getX(offset); const b = index!.getX(offset + 1); const c = index!.getX(offset + 2);
      const signedTwiceArea = (uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a))
        - (uv.getY(b) - uv.getY(a)) * (uv.getX(c) - uv.getX(a));
      expect(signedTwiceArea).toBeGreaterThan(0);
      twiceArea += signedTwiceArea;
    }
    expect(twiceArea / 2).toBeCloseTo(1);
    expect(geometry.boundingSphere?.radius).toBeCloseTo(Math.hypot(1, 0.5));
    geometry.dispose();
  });
  it('advances predictably and snaps for reduced motion', () => {
    expect(projectionTarget('globe')).toBe(0); expect(projectionTarget('map')).toBe(1);
    expect(advanceProjectionMix(0, 1, 0.525, false)).toBe(0.5);
    expect(advanceProjectionMix(0.75, 0, 0.525, false)).toBe(0.25);
    expect(advanceProjectionMix(0.25, 1, 0.01, true)).toBe(1);
    expect(easeProjectionMix(0.5)).toBe(0.5);
  });
});

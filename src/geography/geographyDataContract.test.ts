import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRID } from '../climate/constants';

interface GeographicManifestFixture {
  coverage: { landCells: number; oceanCells: number; namedLandCells: number; namedOceanCells: number; unknownCells: number };
  encoding: { filename: string };
  places: Array<{ id: number }>;
}

describe('checked-in geographic data', () => {
  it('covers every canonical grid cell with valid place ids', () => {
    const manifest = JSON.parse(readFileSync('public/data/geography/manifest.json', 'utf8')) as GeographicManifestFixture;
    const binaryPath = `public/data/geography/${manifest.encoding.filename}`;
    expect(statSync(binaryPath).size).toBe(GRID.cellCount * 2);
    expect(manifest.coverage.landCells + manifest.coverage.oceanCells).toBe(GRID.cellCount);
    expect(manifest.coverage.namedLandCells).toBe(manifest.coverage.landCells);
    expect(manifest.coverage.namedOceanCells).toBe(manifest.coverage.oceanCells);
    expect(manifest.coverage.unknownCells).toBe(0);

    const bytes = readFileSync(binaryPath);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let minimumId = Number.POSITIVE_INFINITY;
    let maximumId = 0;
    for (let cell = 0; cell < GRID.cellCount; cell += 1) {
      const id = view.getUint16(cell * 2, true);
      minimumId = Math.min(minimumId, id);
      maximumId = Math.max(maximumId, id);
    }
    expect(minimumId).toBeGreaterThan(0);
    expect(maximumId).toBeLessThanOrEqual(manifest.places.length);
  });
});

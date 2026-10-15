import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { latLonToGridCell } from '../climate/grid';
import { geographicPlaceAt, loadGeographicIndex } from './geographicIndex';

const manifestBytes = readFileSync('public/data/geography/manifest.json');
const cellBytes = readFileSync('public/data/geography/cells.bin');

function response(bytes: Uint8Array, contentType: string): Response {
  return new Response(Uint8Array.from(bytes).buffer, { status: 200, headers: { 'content-type': contentType } });
}

describe('geographic name index', () => {
  it('loads the shared static assets and resolves representative feature types', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
      return Promise.resolve(url.endsWith('manifest.json')
        ? response(manifestBytes, 'application/json')
        : response(cellBytes, 'application/octet-stream'));
    });
    const index = await loadGeographicIndex('/temperies/', fetcher);
    const placeAt = (latitude: number, longitude: number) => geographicPlaceAt(index, latLonToGridCell(latitude, longitude).index);

    expect(placeAt(42.36, -71.06)).toMatchObject({ kind: 'country', name: 'United States of America', type: 'Country' });
    expect(placeAt(19.6, -155.5)).toMatchObject({ kind: 'island', name: 'Hawai‘i', type: 'Island group' });
    expect(placeAt(47.7, -87.5)).toMatchObject({ kind: 'inland-water', name: 'Lake Superior', type: 'Lake' });
    expect(placeAt(35, 18)).toMatchObject({ kind: 'marine', name: 'Mediterranean Sea', type: 'Sea' });
    expect(placeAt(-25, -130)).toMatchObject({ kind: 'marine', name: 'South Pacific Ocean', type: 'Ocean' });
    expect(fetcher).toHaveBeenNthCalledWith(1, '/temperies/data/geography/manifest.json', undefined);
    expect(fetcher).toHaveBeenNthCalledWith(2, '/temperies/data/geography/cells.bin', undefined);
  });

  it('returns null for invalid cell indexes', () => {
    expect(geographicPlaceAt({ cells: new Uint16Array([0]), places: [null] }, -1)).toBeNull();
    expect(geographicPlaceAt({ cells: new Uint16Array([0]), places: [null] }, 1)).toBeNull();
  });
});

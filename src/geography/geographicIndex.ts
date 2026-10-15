import { GRID } from '../climate/constants';
import { parseLittleEndianUint16 } from '../climate/binary';
import type { Fetcher } from '../climate/frameLoader';
import type { GeographicIndex, GeographicPlace, GeographicPlaceKind } from './types';

interface GeographicManifest {
  encoding: { filename: string; type: 'Uint16'; byteOrder: 'little-endian'; unknown: 0 };
  grid: { width: number; height: number; cellCount: number; resolution: number; latitudeOrigin: number; longitudeOrigin: number };
  places: GeographicPlace[];
  schemaVersion: '1.0.0';
}

const PLACE_KINDS = new Set<GeographicPlaceKind>(['country', 'island', 'inland-water', 'marine']);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function parseManifest(value: unknown): GeographicManifest {
  const root = object(value, 'Geographic manifest');
  if (root.schemaVersion !== '1.0.0') throw new Error('Geographic manifest has an unsupported schema version');
  const grid = object(root.grid, 'Geographic grid');
  const expectedGrid = {
    width: GRID.width,
    height: GRID.height,
    cellCount: GRID.cellCount,
    resolution: GRID.resolution,
    latitudeOrigin: GRID.latitudeOrigin,
    longitudeOrigin: GRID.longitudeOrigin,
  };
  for (const [key, expected] of Object.entries(expectedGrid)) {
    if (grid[key] !== expected) throw new Error(`Geographic grid ${key} must be ${expected}`);
  }
  const encoding = object(root.encoding, 'Geographic encoding');
  if (typeof encoding.filename !== 'string' || !encoding.filename || encoding.type !== 'Uint16' || encoding.byteOrder !== 'little-endian' || encoding.unknown !== 0) {
    throw new Error('Geographic encoding is invalid');
  }
  if (!Array.isArray(root.places)) throw new Error('Geographic places must be an array');
  const places = root.places.map((value, index) => {
    const place = object(value, `Geographic place ${index}`);
    if (!Number.isInteger(place.id) || place.id !== index + 1) throw new Error(`Geographic place ${index} has an invalid id`);
    if (typeof place.kind !== 'string' || !PLACE_KINDS.has(place.kind as GeographicPlaceKind)) throw new Error(`Geographic place ${index} has an invalid kind`);
    if (typeof place.name !== 'string' || !place.name.trim() || typeof place.type !== 'string' || !place.type.trim()) throw new Error(`Geographic place ${index} has an invalid label`);
    return { id: place.id, kind: place.kind as GeographicPlaceKind, name: place.name, type: place.type };
  });
  return { schemaVersion: '1.0.0', grid: expectedGrid, encoding: encoding as GeographicManifest['encoding'], places };
}

function dataUrl(baseUrl: string, filename: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}data/geography/${filename.replace(/^\/+/, '')}`;
}

async function checkedResponse(url: string, fetcher: Fetcher, signal?: AbortSignal): Promise<Response> {
  const response = await fetcher(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Geographic names are unavailable (${response.status})`);
  return response;
}

export async function loadGeographicIndex(baseUrl = import.meta.env.BASE_URL, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<GeographicIndex> {
  const manifestResponse = await checkedResponse(dataUrl(baseUrl, 'manifest.json'), fetcher, signal);
  let json: unknown;
  try { json = await manifestResponse.json(); } catch { throw new Error('Geographic manifest is not valid JSON'); }
  const manifest = parseManifest(json);
  const binaryResponse = await checkedResponse(dataUrl(baseUrl, manifest.encoding.filename), fetcher, signal);
  const cells = parseLittleEndianUint16(await binaryResponse.arrayBuffer(), manifest.grid.cellCount);
  const places: Array<GeographicPlace | null> = [null, ...manifest.places];
  for (const id of cells) if (id >= places.length) throw new Error(`Geographic index references unknown place id ${id}`);
  return { cells, places };
}

export function geographicPlaceAt(index: GeographicIndex, cellIndex: number): GeographicPlace | null {
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= index.cells.length) return null;
  return index.places[index.cells[cellIndex]!] ?? null;
}

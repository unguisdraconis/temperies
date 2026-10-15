import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea, geoBounds, geoContains } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';
import { GRID } from '../../src/climate/constants';
import { latLonToGridCell } from '../../src/climate/grid';

type AreaGeometry = Polygon | MultiPolygon;
type AreaFeature = Feature<AreaGeometry, Record<string, unknown>>;
type PointFeature = Feature<Point, Record<string, unknown>>;
type PlaceKind = 'country' | 'island' | 'inland-water' | 'marine';

interface Candidate {
  feature: AreaFeature;
  kind: PlaceKind;
  name: string;
  type: string;
}

interface GeneratedPlace {
  id: number;
  kind: PlaceKind;
  name: string;
  type: string;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_ROOT = resolve(PROJECT_ROOT, 'untouched_data/natural-earth');
const OUTPUT_ROOT = resolve(PROJECT_ROOT, 'public/data/geography');
const MASK_PATH = resolve(PROJECT_ROOT, 'public/data/2025/surface-mask.bin');
const NATURAL_EARTH_REVISION = 'f1890d9f152c896d250a77557a5751a93d494776';

const SOURCE_HASHES = {
  'ne_10m_lakes.geojson': '2d036f53dedec578001c5c30c2959ee7d4eebc1306900fa4367c49929ec8f2d9',
  'ne_10m_geography_marine_polys.geojson': '53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66c',
  'ne_10m_geography_regions_polys.geojson': 'b7b26e50ea917d3696aec87f932def2bf5f890f5770e441d59c162c6f4c92a77',
  'ne_10m_geography_regions_points.geojson': '25821b530966e62756faebf53699f12bf73550f8228aa4bbdf3e4132dd7cf806',
} as const;

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readNaturalEarth<TGeometry extends AreaGeometry | Point>(filename: keyof typeof SOURCE_HASHES): Promise<FeatureCollection<TGeometry, Record<string, unknown>>> {
  const bytes = await readFile(resolve(SOURCE_ROOT, filename));
  const actualHash = sha256(bytes);
  if (actualHash !== SOURCE_HASHES[filename]) {
    throw new Error(`${filename} failed SHA-256 validation. Run npm run acquire:geography to restore the pinned source.`);
  }
  return JSON.parse(bytes.toString('utf8')) as FeatureCollection<TGeometry, Record<string, unknown>>;
}

function property(properties: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function sentenceCase(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value.toLocaleLowerCase('en').replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('en'));
}

function displayType(value: string): string {
  return value.toLocaleLowerCase('en').replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('en'));
}

function areaCandidates(
  collection: FeatureCollection<AreaGeometry, Record<string, unknown>>,
  kind: PlaceKind,
  allowedClasses?: ReadonlySet<string>,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const sourceFeature of collection.features) {
    if (!sourceFeature.geometry) continue;
    const properties = sourceFeature.properties ?? {};
    const rawClass = property(properties, 'featurecla', 'FEATURECLA');
    if (!rawClass || (allowedClasses && !allowedClasses.has(rawClass.toLocaleLowerCase('en')))) continue;
    const rawName = property(properties, 'name', 'NAME', 'name_en', 'NAME_EN');
    if (!rawName) continue;
    const englishName = property(properties, 'name_en', 'NAME_EN');
    const name = sentenceCase(rawName === rawName.toUpperCase() && englishName ? englishName : rawName);
    candidates.push({
      feature: sourceFeature,
      kind,
      name,
      type: kind === 'inland-water' ? displayType(rawClass) : kind === 'marine' ? displayType(rawClass) : rawClass.toLocaleLowerCase('en') === 'island group' ? 'Island group' : 'Island',
    });
  }
  return candidates;
}

function countryCandidates(): Candidate[] {
  const topology = worldData as unknown as Topology<{ countries: GeometryCollection }>;
  const countries = feature(topology, topology.objects.countries) as unknown as FeatureCollection<AreaGeometry, { name?: string }>;
  return countries.features.flatMap((country) => {
    const name = country.properties?.name?.trim();
    if (!name || !country.geometry) return [];
    return [{ feature: country, kind: 'country' as const, name, type: 'Country' }];
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function rangesForBounds(featureBounds: [[number, number], [number, number]]): Array<{ firstColumn: number; lastColumn: number }> {
  const [[west], [east]] = featureBounds;
  const range = (minimum: number, maximum: number) => ({
    firstColumn: clamp(Math.ceil((minimum - GRID.longitudeOrigin) / GRID.resolution), 0, GRID.width - 1),
    lastColumn: clamp(Math.floor((maximum - GRID.longitudeOrigin) / GRID.resolution), 0, GRID.width - 1),
  });
  return west <= east ? [range(west, east)] : [range(west, 180), range(-180, east)];
}

const maskBytes = await readFile(MASK_PATH);
if (maskBytes.byteLength !== GRID.cellCount) throw new Error(`Expected ${GRID.cellCount} surface-mask bytes, received ${maskBytes.byteLength}`);
const surfaceMask = new Uint8Array(maskBytes.buffer, maskBytes.byteOffset, maskBytes.byteLength);
const cellPlaceIds = new Uint16Array(GRID.cellCount);
const places: GeneratedPlace[] = [];
const placeIds = new Map<string, number>();

function registerPlace(candidate: Pick<Candidate, 'kind' | 'name' | 'type'>): number {
  const key = `${candidate.kind}\u0000${candidate.type}\u0000${candidate.name}`;
  const existing = placeIds.get(key);
  if (existing !== undefined) return existing;
  const id = places.length + 1;
  if (id >= 65_535) throw new Error('Geographic place count exceeds Uint16 capacity');
  places.push({ id, kind: candidate.kind, name: candidate.name, type: candidate.type });
  placeIds.set(key, id);
  return id;
}

function rasterize(candidates: Candidate[], requiredSurface: 0 | 1 | null, label: string, onlyUnnamed = false): void {
  const scores = new Float64Array(GRID.cellCount);
  scores.fill(Number.POSITIVE_INFINITY);
  let namedCells = 0;
  for (const candidate of candidates) {
    const bounds = geoBounds(candidate.feature);
    const area = geoArea(candidate.feature);
    const firstRow = clamp(Math.ceil((GRID.latitudeOrigin - bounds[1][1]) / GRID.resolution), 0, GRID.height - 1);
    const lastRow = clamp(Math.floor((GRID.latitudeOrigin - bounds[0][1]) / GRID.resolution), 0, GRID.height - 1);
    const id = registerPlace(candidate);
    for (const { firstColumn, lastColumn } of rangesForBounds(bounds)) {
      for (let row = firstRow; row <= lastRow; row += 1) {
        const latitude = GRID.latitudeOrigin - row * GRID.resolution;
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const index = row * GRID.width + column;
          if ((requiredSurface !== null && surfaceMask[index] !== requiredSurface) || (onlyUnnamed && cellPlaceIds[index] !== 0) || area >= scores[index]!) continue;
          const longitude = GRID.longitudeOrigin + column * GRID.resolution;
          if (!geoContains(candidate.feature, [longitude, latitude])) continue;
          if (scores[index] === Number.POSITIVE_INFINITY) namedCells += 1;
          scores[index] = area;
          cellPlaceIds[index] = id;
        }
      }
    }
  }
  console.log(`${label}: ${candidates.length.toLocaleString()} features, ${namedCells.toLocaleString()} cells`);
}

const lakes = await readNaturalEarth<AreaGeometry>('ne_10m_lakes.geojson');
const marine = await readNaturalEarth<AreaGeometry>('ne_10m_geography_marine_polys.geojson');
const regions = await readNaturalEarth<AreaGeometry>('ne_10m_geography_regions_polys.geojson');
const regionPoints = await readNaturalEarth<Point>('ne_10m_geography_regions_points.geojson');

rasterize(countryCandidates(), 1, 'Countries');
rasterize(areaCandidates(regions, 'island', new Set(['island', 'island group'])), 1, 'Islands and island groups');

const pointScores = new Float64Array(GRID.cellCount);
pointScores.fill(Number.POSITIVE_INFINITY);
let pointAssignments = 0;
for (const point of regionPoints.features as PointFeature[]) {
  if (!point.geometry) continue;
  const properties = point.properties ?? {};
  const featureClass = property(properties, 'featurecla')?.toLocaleLowerCase('en');
  if (featureClass !== 'island' && featureClass !== 'island group') continue;
  const name = property(properties, 'name_en', 'name');
  if (!name) continue;
  const longitude = point.geometry.coordinates[0];
  const latitude = point.geometry.coordinates[1];
  if (longitude === undefined || latitude === undefined) continue;
  const origin = latLonToGridCell(latitude, longitude);
  let best: { index: number; distance: number } | null = null;
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    const row = origin.row + rowOffset;
    if (row < 0 || row >= GRID.height) continue;
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const column = (origin.column + columnOffset + GRID.width) % GRID.width;
      const index = row * GRID.width + column;
      if (surfaceMask[index] !== 1) continue;
      const cellLatitude = GRID.latitudeOrigin - row * GRID.resolution;
      const cellLongitude = GRID.longitudeOrigin + column * GRID.resolution;
      const longitudeDistance = Math.abs(cellLongitude - longitude);
      const wrappedLongitudeDistance = Math.min(longitudeDistance, 360 - longitudeDistance) * Math.cos(latitude * Math.PI / 180);
      const distance = Math.hypot(cellLatitude - latitude, wrappedLongitudeDistance);
      if (!best || distance < best.distance) best = { index, distance };
    }
  }
  if (!best || best.distance > 0.4 || best.distance >= pointScores[best.index]!) continue;
  pointScores[best.index] = best.distance;
  cellPlaceIds[best.index] = registerPlace({ kind: 'island', name, type: featureClass === 'island group' ? 'Island group' : 'Island' });
  pointAssignments += 1;
}
console.log(`Island label points: ${pointAssignments.toLocaleString()} cells`);

const marineCandidates = areaCandidates(marine, 'marine');
rasterize(marineCandidates, 0, 'Marine regions');
rasterize(areaCandidates(lakes, 'inland-water'), null, 'Inland waters');

const antarcticaId = registerPlace({ kind: 'country', name: 'Antarctica', type: 'Country' });
const arcticOceanId = registerPlace({ kind: 'marine', name: 'Arctic Ocean', type: 'Ocean' });
const southernOceanId = registerPlace({ kind: 'marine', name: 'Southern Ocean', type: 'Ocean' });
for (let index = 0; index < GRID.cellCount; index += 1) {
  if (cellPlaceIds[index] !== 0) continue;
  const latitude = GRID.latitudeOrigin - Math.floor(index / GRID.width) * GRID.resolution;
  if (surfaceMask[index] === 1 && latitude < -60) cellPlaceIds[index] = antarcticaId;
  else if (surfaceMask[index] === 0 && latitude > 66) cellPlaceIds[index] = arcticOceanId;
  else if (surfaceMask[index] === 0 && latitude < -60) cellPlaceIds[index] = southernOceanId;
}

function fillNearbyGaps(maxRadius: number): number {
  const source = cellPlaceIds.slice();
  let filled = 0;
  for (let index = 0; index < GRID.cellCount; index += 1) {
    if (source[index] !== 0) continue;
    const row = Math.floor(index / GRID.width);
    const column = index % GRID.width;
    let best: { id: number; distance: number } | null = null;
    for (let radius = 1; radius <= maxRadius && !best; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        const candidateRow = row + rowOffset;
        if (candidateRow < 0 || candidateRow >= GRID.height) continue;
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          if (Math.abs(rowOffset) !== radius && Math.abs(columnOffset) !== radius) continue;
          const candidateColumn = (column + columnOffset + GRID.width) % GRID.width;
          const candidateIndex = candidateRow * GRID.width + candidateColumn;
          if (surfaceMask[candidateIndex] !== surfaceMask[index]) continue;
          const id = source[candidateIndex]!;
          if (id === 0) continue;
          const place = places[id - 1]!;
          if (surfaceMask[index] === 0 && place.kind !== 'marine' && place.kind !== 'inland-water') continue;
          if (surfaceMask[index] === 1 && place.kind === 'marine') continue;
          const distance = Math.hypot(rowOffset, columnOffset);
          if (!best || distance < best.distance) best = { id, distance };
        }
      }
    }
    if (!best) continue;
    cellPlaceIds[index] = best.id;
    filled += 1;
  }
  return filled;
}

console.log(`Nearby gap fallbacks: ${fillNearbyGaps(4).toLocaleString()} cells`);
rasterize(marineCandidates, null, 'Cross-surface marine edge cases', true);

function fillMarinePolygonHoles(): number {
  let filled = 0;
  for (let index = 0; index < GRID.cellCount; index += 1) {
    if (cellPlaceIds[index] !== 0) continue;
    const row = Math.floor(index / GRID.width);
    const longitude = GRID.longitudeOrigin + (index % GRID.width) * GRID.resolution;
    const latitude = GRID.latitudeOrigin - row * GRID.resolution;
    let best: { candidate: Candidate; area: number } | null = null;
    for (const candidate of marineCandidates) {
      const [[west, south], [east, north]] = geoBounds(candidate.feature);
      const withinLongitude = west <= east ? longitude >= west && longitude <= east : longitude >= west || longitude <= east;
      if (!withinLongitude || latitude < south || latitude > north) continue;
      const area = geoArea(candidate.feature);
      if (!best || area < best.area) best = { candidate, area };
    }
    if (!best) continue;
    cellPlaceIds[index] = registerPlace(best.candidate);
    filled += 1;
  }
  return filled;
}

console.log(`Marine polygon-hole fallbacks: ${fillMarinePolygonHoles().toLocaleString()} cells`);

const counts = {
  landCells: 0,
  oceanCells: 0,
  namedLandCells: 0,
  namedOceanCells: 0,
  unknownCells: 0,
};
for (let index = 0; index < GRID.cellCount; index += 1) {
  const named = cellPlaceIds[index] !== 0;
  if (surfaceMask[index] === 1) {
    counts.landCells += 1;
    if (named) counts.namedLandCells += 1;
  } else {
    counts.oceanCells += 1;
    if (named) counts.namedOceanCells += 1;
  }
  if (!named) counts.unknownCells += 1;
}

const binary = Buffer.allocUnsafe(cellPlaceIds.byteLength);
for (let index = 0; index < cellPlaceIds.length; index += 1) binary.writeUInt16LE(cellPlaceIds[index]!, index * 2);
const manifest = {
  schemaVersion: '1.0.0',
  grid: {
    width: GRID.width,
    height: GRID.height,
    cellCount: GRID.cellCount,
    resolution: GRID.resolution,
    latitudeOrigin: GRID.latitudeOrigin,
    longitudeOrigin: GRID.longitudeOrigin,
  },
  encoding: { filename: 'cells.bin', type: 'Uint16', byteOrder: 'little-endian', unknown: 0 },
  places,
  coverage: counts,
  sources: {
    naturalEarth: {
      version: '5.1.2',
      revision: NATURAL_EARTH_REVISION,
      scale: '1:10m',
      files: Object.entries(SOURCE_HASHES).map(([filename, hash]) => ({ filename, sha256: hash })),
    },
    countries: { package: 'world-atlas', version: '2.0.2', file: 'countries-110m.json' },
    surfaceRouting: 'public/data/2025/surface-mask.bin',
  },
};

await mkdir(OUTPUT_ROOT, { recursive: true });
await writeFile(resolve(OUTPUT_ROOT, 'cells.bin'), binary);
await writeFile(resolve(OUTPUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${binary.byteLength.toLocaleString()} bytes and ${places.length.toLocaleString()} place records to ${OUTPUT_ROOT}`);
console.log(counts);

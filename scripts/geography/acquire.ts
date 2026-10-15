import { createHash } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_ROOT = resolve(PROJECT_ROOT, 'untouched_data/natural-earth');
const NATURAL_EARTH_REVISION = 'f1890d9f152c896d250a77557a5751a93d494776';
const RAW_ROOT = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_REVISION}/geojson`;

const SOURCES = [
  ['ne_10m_lakes.geojson', '2d036f53dedec578001c5c30c2959ee7d4eebc1306900fa4367c49929ec8f2d9'],
  ['ne_10m_geography_marine_polys.geojson', '53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66c'],
  ['ne_10m_geography_regions_polys.geojson', 'b7b26e50ea917d3696aec87f932def2bf5f890f5770e441d59c162c6f4c92a77'],
  ['ne_10m_geography_regions_points.geojson', '25821b530966e62756faebf53699f12bf73550f8228aa4bbdf3e4132dd7cf806'],
] as const;

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

await mkdir(SOURCE_ROOT, { recursive: true });

for (const [filename, expectedHash] of SOURCES) {
  const response = await fetch(`${RAW_ROOT}/${filename}`);
  if (!response.ok) throw new Error(`Unable to acquire ${filename}: ${response.status} ${response.statusText}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actualHash = sha256(bytes);
  if (actualHash !== expectedHash) {
    throw new Error(`${filename} failed SHA-256 validation: expected ${expectedHash}, received ${actualHash}`);
  }
  const target = resolve(SOURCE_ROOT, filename);
  const temporary = `${target}.part`;
  await writeFile(temporary, bytes);
  await rm(target, { force: true });
  await rename(temporary, target);
  console.log(`Acquired ${filename} (${bytes.byteLength.toLocaleString()} bytes)`);
}

console.log(`Natural Earth v5.1.2 sources are ready in ${SOURCE_ROOT}`);

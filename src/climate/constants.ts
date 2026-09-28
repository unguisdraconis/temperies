export const GRID = Object.freeze({
  width: 1440,
  height: 720,
  cellCount: 1_036_800,
  resolution: 0.25,
  latitudeOrigin: 89.875,
  longitudeOrigin: -179.875,
} as const);

export const ENCODING = Object.freeze({
  type: 'Uint16',
  byteOrder: 'little-endian',
  scale: 0.01,
  offset: -100,
  missing: 65_535,
  reserved: 65_534,
  bytesPerValue: 2,
} as const);

export const ANNUAL_SCALE = Object.freeze({
  minimum: -80,
  maximum: 60,
  histogramBinWidth: 0.5,
  histogramBinCount: 280,
} as const);

// Cosine-of-latitude area-weighted and period-duration-weighted median of the
// checked-in 2025 composite weekly-mean fields.
export const ANNUAL_COMPOSITE_MEDIAN_C = 21.08;

export const FRAME_COUNT = 52;
export const DATA_YEAR = 2025;
export const FRAME_CACHE_SIZE = 5;

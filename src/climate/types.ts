export type DisplayMode = 'composite' | 'air' | 'sst';
export type TemperatureRenderStyle = 'heatmap' | 'smooth';
export type ProjectionMode = 'globe' | 'map';
export type TemperatureUnit = 'C' | 'F';
export type SurfaceType = 'land' | 'ocean';

export interface GridCell { row: number; column: number; index: number }
export interface LatLon { latitude: number; longitude: number }
export interface HoveredCell extends GridCell, LatLon {
  surface: SurfaceType;
  temperatureC: number | null;
  clientX: number;
  clientY: number;
  interpolation: number;
}

export interface TemperatureRange { value: number; minimum: number; maximum: number }
export type TrackedExtreme = 'minimum' | 'maximum';
export interface LegendSelection extends TemperatureRange {
  locked: boolean;
  trackedExtreme?: TrackedExtreme;
  bandHalfWidthC?: number;
}
export interface VectorLayerVisibility { countries: boolean; coastlines: boolean }
export type FrameLoadState =
  | { status: 'idle' }
  | { status: 'loading'; requestedWeek: number; retainingFrame: boolean }
  | { status: 'ready'; week: number }
  | { status: 'error'; message: string; recoverable: boolean };

export interface ClimateGrid {
  width: number; height: number; cellCount: number; resolution: number;
  latitudeOrigin: number; longitudeOrigin: number;
  rowDirection: 'north-to-south'; columnDirection: 'west-to-east'; index: string;
}
export interface ClimateEncoding {
  type: 'Uint16'; byteOrder: 'little-endian'; scale: number; offset: number;
  missing: number; reserved: number; units: 'degrees Celsius';
}
export interface ClimateLegend {
  minimum: number; maximum: number; histogramBinWidth: number;
  histogramBinCount: number; fixedAnnualScale: true;
}
export interface ClimateSource { dataset: string; variable: string }
export interface ClimateSources { land: ClimateSource; ocean: ClimateSource; units: string }
export interface MaskMetadata {
  filename: string; type: 'Uint8'; ocean: 0; land: 1; source: string;
}
export interface Extrema { land: number; ocean: number; combined: number }
export interface FrameHistograms {
  binMinimum: number; binWidth: number; areaTotal: number; landArea: number; oceanArea: number;
  land: number[]; ocean: number[]; combined: number[];
}
export interface FrameMetadata {
  id: string; frame: number; startDate: string; endDate: string; representativeDate: string;
  observations: number; air: string; sst: string; minimums: Extrema; maximums: Extrema;
  histograms: FrameHistograms;
}
export interface ClimateManifest {
  schemaVersion: '1.0.0'; prototypeVersion: string; temporalCoverage: 'annual' | 'reference'; created: string; year: number; notice: string;
  grid: ClimateGrid; encoding: ClimateEncoding; legend: ClimateLegend;
  sources: ClimateSources; mask: MaskMetadata; frames: FrameMetadata[];
}
export interface DecodedFrame { id: string; air: Uint16Array; sst: Uint16Array }
export interface FramePair {
  current: DecodedFrame; next: DecodedFrame;
  currentMeta: FrameMetadata; nextMeta: FrameMetadata;
}

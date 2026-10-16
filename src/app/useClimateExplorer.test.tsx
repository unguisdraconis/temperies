import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClimateManifest, DecodedFrame, FrameMetadata } from '../climate/types';
import type { GeographicIndex } from '../geography/types';
import { useClimateExplorer } from './useClimateExplorer';

const mocks = vi.hoisted(() => ({
  loadManifest: vi.fn(),
  loadMask: vi.fn(),
  loadFrame: vi.fn(),
  prefetch: vi.fn(),
  loadGeographicIndex: vi.fn(),
}));

vi.mock('../climate/frameLoader', () => ({
  loadManifest: mocks.loadManifest,
  loadMask: mocks.loadMask,
  FrameRepository: class MockFrameRepository {
    constructor(readonly manifest: ClimateManifest) {}
    load(frame: FrameMetadata, signal?: AbortSignal): Promise<DecodedFrame> {
      return mocks.loadFrame(frame, signal) as Promise<DecodedFrame>;
    }
    prefetch(frame: FrameMetadata | undefined): void { mocks.prefetch(frame); }
    frameAt(index: number): FrameMetadata {
      const normalized = ((index % this.manifest.frames.length) + this.manifest.frames.length) % this.manifest.frames.length;
      return this.manifest.frames[normalized]!;
    }
  },
}));

vi.mock('../geography/geographicIndex', () => ({ loadGeographicIndex: mocks.loadGeographicIndex }));

const frameMeta = {
  id: 'week-00', frame: 0, startDate: '2025-01-01', endDate: '2025-01-07', representativeDate: '2025-01-04',
  observations: 7, air: 'air/week-00.bin', sst: 'sst/week-00.bin',
  minimums: { land: -1, ocean: 1, combined: -1 }, maximums: { land: 2, ocean: 3, combined: 3 },
  histograms: { binMinimum: -80, binWidth: 0.5, areaTotal: 1, landArea: 1, oceanArea: 1, land: [1], ocean: [1], combined: [1] },
} satisfies FrameMetadata;
const manifest = {
  schemaVersion: '1.0.0', prototypeVersion: 'test', temporalCoverage: 'reference', created: '2025-01-01', year: 2025, notice: 'test',
  grid: { width: 1, height: 1, cellCount: 1, resolution: 0.25, latitudeOrigin: 90, longitudeOrigin: -180, rowDirection: 'north-to-south', columnDirection: 'west-to-east', index: 'row-major' },
  encoding: { type: 'Uint16', byteOrder: 'little-endian', scale: 0.01, offset: -100, missing: 65535, reserved: 65534, units: 'degrees Celsius' },
  legend: { minimum: -80, maximum: 60, histogramBinWidth: 0.5, histogramBinCount: 280, fixedAnnualScale: true },
  sources: { land: { dataset: 'land', variable: 'air' }, ocean: { dataset: 'ocean', variable: 'sst' }, units: 'degrees Celsius' },
  mask: { filename: 'surface-mask.bin', type: 'Uint8', ocean: 0, land: 1, source: 'test' }, frames: [frameMeta],
} satisfies ClimateManifest;
const decoded = { id: 'week-00', air: new Uint16Array([1]), sst: new Uint16Array([2]) } satisfies DecodedFrame;
const geography = { cells: new Uint16Array([0]), places: [null] } satisfies GeographicIndex;

describe('climate explorer boot orchestration', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.loadManifest.mockResolvedValue(manifest);
    mocks.loadMask.mockResolvedValue(new Uint8Array([1]));
    mocks.loadFrame.mockResolvedValue(decoded);
  });

  it('renders climate data when optional geography fails', async () => {
    mocks.loadGeographicIndex.mockRejectedValue(new Error('geography unavailable'));
    const { result } = renderHook(() => useClimateExplorer());

    await waitFor(() => expect(result.current.state.framePair?.current).toBe(decoded));
    expect(result.current.state.fatalError).toBeNull();
    expect(result.current.state.geography).toBeNull();
    expect(result.current.state.loadState).toEqual({ status: 'ready', week: 0 });
  });

  it('adds geography after the initial climate frame is already ready', async () => {
    let resolveGeography!: (value: GeographicIndex) => void;
    mocks.loadGeographicIndex.mockReturnValue(new Promise<GeographicIndex>((resolve) => { resolveGeography = resolve; }));
    const { result } = renderHook(() => useClimateExplorer());

    await waitFor(() => expect(result.current.state.framePair?.current).toBe(decoded));
    expect(result.current.state.geography).toBeNull();
    await act(async () => { resolveGeography(geography); await Promise.resolve(); });
    expect(result.current.state.geography).toBe(geography);
  });
});

import { describe, expect, it } from 'vitest';
import { climateReducer, effectiveLegendSelection, initialClimateState } from './climateReducer';
import type { ClimateManifest, FramePair, HoveredCell, LegendSelection } from '../climate/types';
import type { GeographicIndex } from '../geography/types';

const pair = { current: { id: 'a', air: new Uint16Array(), sst: new Uint16Array() }, next: { id: 'b', air: new Uint16Array(), sst: new Uint16Array() } } as FramePair;
const resetPair: FramePair = { ...pair, current: { ...pair.current, id: 'reset' }, next: { ...pair.next, id: 'reset' } };
const cell = { row: 1, column: 2, index: 1442, latitude: 42, longitude: -71, surface: 'land', temperatureC: 12, clientX: 100, clientY: 120, interpolation: 0 } satisfies HoveredCell;
describe('climate state transitions', () => {
  it('defaults to the diverging palette and switches palettes without changing climate frames', () => {
    expect(initialClimateState.palette).toBe('diverging');
    const state = { ...initialClimateState, framePair: pair };
    const sequential = climateReducer(state, { type: 'SET_PALETTE', palette: 'sequential' });
    expect(sequential.palette).toBe('sequential'); expect(sequential.framePair).toBe(pair);
  });
  it('defaults to the globe and changes projection without changing climate frames', () => {
    expect(initialClimateState.projectionMode).toBe('globe');
    const state = { ...initialClimateState, framePair: pair };
    const map = climateReducer(state, { type: 'SET_PROJECTION_MODE', projectionMode: 'map' });
    expect(map.projectionMode).toBe('map'); expect(map.framePair).toBe(pair);
  });
  it('defaults to the native heatmap style and switches without changing climate frames', () => {
    expect(initialClimateState.renderStyle).toBe('heatmap');
    const state = { ...initialClimateState, framePair: pair };
    const smooth = climateReducer(state, { type: 'SET_RENDER_STYLE', renderStyle: 'smooth' });
    expect(smooth.renderStyle).toBe('smooth'); expect(smooth.framePair).toBe(pair);
  });
  it('retains the active frame until a requested pair is atomically ready', () => {
    const old = { ...initialClimateState, framePair: pair, week: 3 };
    const loading = climateReducer(old, { type: 'FRAME_REQUEST', week: 4, requestId: 9 });
    expect(loading.week).toBe(3); expect(loading.framePair).toBe(pair); expect(loading.loadState).toMatchObject({ status: 'loading', retainingFrame: true });
    const ready = climateReducer(loading, { type: 'FRAME_SUCCESS', week: 4, requestId: 9, pair });
    expect(ready.week).toBe(4); expect(ready.loadState).toEqual({ status: 'ready', week: 4 });
  });
  it('preserves a locked temperature range when the current week changes', () => {
    const locked = { value: 20, minimum: 19.5, maximum: 20.5, locked: true } satisfies LegendSelection;
    const selected = climateReducer(initialClimateState, { type: 'SET_LEGEND_LOCK', selection: locked });
    const loading = climateReducer(selected, { type: 'FRAME_REQUEST', week: 4, requestId: 9 });
    const ready = climateReducer(loading, { type: 'FRAME_SUCCESS', week: 4, requestId: 9, pair });
    expect(ready.legendLocked).toBe(locked);
    expect(effectiveLegendSelection(ready)).toBe(locked);
  });
  it('updates a tracked weekly extreme when a new frame or display mode becomes active', () => {
    const tracked = {
      value: -47,
      minimum: -49.5,
      maximum: -44.5,
      locked: true,
      trackedExtreme: 'minimum',
      bandHalfWidthC: 2.5,
    } satisfies LegendSelection;
    const pairWithExtrema = {
      ...pair,
      currentMeta: {
        minimums: { combined: -12, land: -15, ocean: -1.5 },
        maximums: { combined: 38, land: 38, ocean: 31 },
      },
    } as FramePair;
    const selected = climateReducer(initialClimateState, { type: 'SET_LEGEND_LOCK', selection: tracked });
    const loading = climateReducer(selected, { type: 'FRAME_REQUEST', week: 4, requestId: 9 });
    const ready = climateReducer(loading, { type: 'FRAME_SUCCESS', week: 4, requestId: 9, pair: pairWithExtrema });
    expect(ready.legendLocked).toEqual({
      value: -12,
      minimum: -14.5,
      maximum: -9.5,
      locked: true,
      trackedExtreme: 'minimum',
      bandHalfWidthC: 2.5,
    });
    expect(climateReducer(ready, { type: 'SET_MODE', mode: 'sst' }).legendLocked).toMatchObject({
      value: -1.5,
      minimum: -4,
      maximum: 1,
      trackedExtreme: 'minimum',
    });
  });
  it('rejects stale responses', () => {
    const loading = climateReducer(initialClimateState, { type: 'FRAME_REQUEST', week: 8, requestId: 4 });
    expect(climateReducer(loading, { type: 'FRAME_SUCCESS', week: 7, requestId: 3, pair })).toBe(loading);
    expect(climateReducer(loading, { type: 'RESET_SUCCESS', requestId: 3, pair: resetPair })).toBe(loading);
  });
  it('accepts optional geography before or after essential boot data', () => {
    const manifest = {} as ClimateManifest;
    const mask = new Uint8Array([1]);
    const geography = { cells: new Uint16Array([0]), places: [null] } satisfies GeographicIndex;
    const geographyFirst = climateReducer(initialClimateState, { type: 'GEOGRAPHY_READY', geography });
    expect(climateReducer(geographyFirst, { type: 'BOOT_READY', manifest, mask }).geography).toBe(geography);
    const bootFirst = climateReducer(initialClimateState, { type: 'BOOT_READY', manifest, mask });
    expect(bootFirst.geography).toBeNull();
    expect(climateReducer(bootFirst, { type: 'GEOGRAPHY_READY', geography }).geography).toBe(geography);
  });
  it('keeps transient and locked selections separate with locked precedence', () => {
    const hover = { value: 1, minimum: 0.5, maximum: 1.5, locked: false } satisfies LegendSelection;
    const locked = { value: 5, minimum: 4.5, maximum: 5.5, locked: true } satisfies LegendSelection;
    const state = climateReducer(climateReducer(initialClimateState, { type: 'SET_LEGEND_HOVER', selection: hover }), { type: 'SET_LEGEND_LOCK', selection: locked });
    expect(state.legendHover).toBeNull(); expect(effectiveLegendSelection(state)).toBe(locked);
  });
  it('pins a selected globe cell until the globe is activated again', () => {
    const hovered = climateReducer(initialClimateState, { type: 'SET_HOVERED_CELL', cell });
    const pinned = climateReducer(hovered, { type: 'TOGGLE_CELL_TOOLTIP', cell });
    expect(pinned).toMatchObject({ hoveredCell: cell, tooltipPinned: true });
    expect(climateReducer(pinned, { type: 'SET_HOVERED_CELL', cell: null })).toBe(pinned);
    expect(climateReducer(pinned, { type: 'SET_HOVERED_CELL', cell: { ...cell, index: 1443 } })).toBe(pinned);
    expect(climateReducer(pinned, { type: 'TOGGLE_CELL_TOOLTIP', cell })).toMatchObject({ hoveredCell: null, tooltipPinned: false });
  });
  it('keeps the old explorer coherent until reset data is ready, then commits every default atomically', () => {
    const customized = {
      ...initialClimateState,
      framePair: pair,
      week: 12,
      mode: 'sst' as const,
      projectionMode: 'map' as const,
      renderStyle: 'smooth' as const,
      palette: 'sequential' as const,
      unit: 'F' as const,
      hoveredCell: cell,
      tooltipPinned: true,
      legendLocked: { value: 5, minimum: 4.5, maximum: 5.5, locked: true } satisfies LegendSelection,
      vectorLayers: { countries: false, coastlines: false },
    };
    const loading = climateReducer(customized, { type: 'FRAME_REQUEST', week: 0, requestId: 9 });
    expect(loading).toMatchObject({ week: 12, mode: 'sst', projectionMode: 'map', resetEpoch: 0 });
    expect(loading.framePair).toBe(pair);
    const reset = climateReducer(loading, { type: 'RESET_SUCCESS', requestId: 9, pair: resetPair });
    expect(reset).toMatchObject({
      week: 0,
      resetEpoch: 1,
      mode: 'composite',
      projectionMode: 'globe',
      renderStyle: 'heatmap',
      palette: 'diverging',
      unit: 'C',
      hoveredCell: null,
      tooltipPinned: false,
      legendHover: null,
      legendLocked: null,
      vectorLayers: { countries: true, coastlines: true },
    });
    expect(reset.framePair).toBe(resetPair);
  });
  it('preserves the old explorer after a failed or canceled reset request', () => {
    const customized = { ...initialClimateState, framePair: pair, week: 12, mode: 'sst' as const };
    const loading = climateReducer(customized, { type: 'FRAME_REQUEST', week: 0, requestId: 9 });
    const failed = climateReducer(loading, { type: 'FRAME_ERROR', requestId: 9, message: 'network' });
    expect(failed).toMatchObject({ week: 12, mode: 'sst', resetEpoch: 0, loadState: { status: 'error', recoverable: true } });
    expect(failed.framePair).toBe(pair);
    const canceled = climateReducer(loading, { type: 'FRAME_CANCEL', requestId: 9, replacementRequestId: 10 });
    expect(canceled).toMatchObject({ week: 12, mode: 'sst', resetEpoch: 0, activeRequestId: 10, loadState: { status: 'ready', week: 12 } });
    expect(canceled.framePair).toBe(pair);
    expect(climateReducer(canceled, { type: 'RESET_SUCCESS', requestId: 9, pair: resetPair })).toBe(canceled);
  });
  it('keeps the active frame after a recoverable frame error', () => {
    const state = { ...initialClimateState, framePair: pair, activeRequestId: 2 };
    expect(climateReducer(state, { type: 'FRAME_ERROR', requestId: 2, message: 'network' })).toMatchObject({ framePair: pair, loadState: { status: 'error', recoverable: true } });
  });
});

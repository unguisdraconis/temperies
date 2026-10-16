import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { FrameRepository, loadManifest, loadMask } from '../climate/frameLoader';
import { resolveDatasetBaseUrl } from '../climate/dataset';
import type { DisplayMode, HoveredCell, LegendSelection, ProjectionMode, TemperaturePalette, TemperatureRenderStyle, TemperatureUnit, VectorLayerVisibility } from '../climate/types';
import { loadGeographicIndex } from '../geography/geographicIndex';
import { climateReducer, effectiveLegendSelection, initialClimateState } from './climateReducer';

export function useClimateExplorer() {
  const [state, dispatch] = useReducer(climateReducer, initialClimateState);
  const repositoryRef = useRef<FrameRepository | null>(null);
  const requestCounter = useRef(0);
  const requestWeekRef = useRef<(week: number) => void>(() => undefined);
  const dataBaseUrl = useMemo(
    () => resolveDatasetBaseUrl(window.location.search, import.meta.env.BASE_URL),
    [],
  );

  const requestWeek = useCallback((week: number) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    const normalized = ((week % repository.manifest.frames.length) + repository.manifest.frames.length) % repository.manifest.frames.length;
    const requestId = ++requestCounter.current;
    dispatch({ type: 'FRAME_REQUEST', week: normalized, requestId });
    const currentMeta = repository.frameAt(normalized);
    void repository.load(currentMeta).then((current) => {
      dispatch({ type: 'FRAME_SUCCESS', week: normalized, requestId, pair: { current, next: current, currentMeta, nextMeta: currentMeta } });
      repository.prefetch(repository.frameAt(normalized - 1)); repository.prefetch(repository.frameAt(normalized + 1));
    }).catch((error: unknown) => dispatch({ type: 'FRAME_ERROR', requestId, message: error instanceof Error ? error.message : 'Unable to load frame' }));
  }, []);
  requestWeekRef.current = requestWeek;

  const resetExplorer = useCallback(() => {
    dispatch({ type: 'RESET_EXPLORER' });
    requestWeek(0);
  }, [requestWeek]);

  useEffect(() => {
    const controller = new AbortController();
    void loadManifest(dataBaseUrl, fetch, controller.signal).then(async (manifest) => {
      const [mask, geography] = await Promise.all([
        loadMask(manifest, dataBaseUrl, fetch, controller.signal),
        loadGeographicIndex(import.meta.env.BASE_URL, fetch, controller.signal),
      ]);
      repositoryRef.current = new FrameRepository(manifest, dataBaseUrl);
      dispatch({ type: 'BOOT_READY', manifest, mask, geography });
      requestWeekRef.current(0);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) dispatch({ type: 'FATAL_ERROR', message: error instanceof Error ? error.message : 'Unable to initialize climate data' });
    });
    return () => controller.abort();
  }, [dataBaseUrl]);

  const actions = useMemo(() => ({
    requestWeek,
    resetExplorer,
    setMode: (mode: DisplayMode) => dispatch({ type: 'SET_MODE', mode }),
    setProjectionMode: (projectionMode: ProjectionMode) => dispatch({ type: 'SET_PROJECTION_MODE', projectionMode }),
    setRenderStyle: (renderStyle: TemperatureRenderStyle) => dispatch({ type: 'SET_RENDER_STYLE', renderStyle }),
    setPalette: (palette: TemperaturePalette) => dispatch({ type: 'SET_PALETTE', palette }),
    setUnit: (unit: TemperatureUnit) => dispatch({ type: 'SET_UNIT', unit }),
    setHoveredCell: (cell: HoveredCell | null) => dispatch({ type: 'SET_HOVERED_CELL', cell }),
    toggleCellTooltip: (cell: HoveredCell) => dispatch({ type: 'TOGGLE_CELL_TOOLTIP', cell }),
    setLegendHover: (selection: LegendSelection | null) => dispatch({ type: 'SET_LEGEND_HOVER', selection }),
    setLegendLock: (selection: LegendSelection | null) => dispatch({ type: 'SET_LEGEND_LOCK', selection }),
    toggleVectorLayer: (layer: keyof VectorLayerVisibility) => dispatch({ type: 'TOGGLE_VECTOR_LAYER', layer }),
  }), [requestWeek, resetExplorer]);

  return { state, actions, highlight: effectiveLegendSelection(state) };
}

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
  const failedRequestRef = useRef<{ week: number; intent: 'navigation' | 'reset' } | null>(null);
  const requestWeekRef = useRef<(week: number) => void>(() => undefined);
  const dataBaseUrl = useMemo(
    () => resolveDatasetBaseUrl(window.location.search, import.meta.env.BASE_URL),
    [],
  );

  const loadWeek = useCallback(async (week: number, intent: 'navigation' | 'reset', signal?: AbortSignal): Promise<boolean> => {
    const repository = repositoryRef.current;
    if (!repository || signal?.aborted) return false;
    const normalized = ((week % repository.manifest.frames.length) + repository.manifest.frames.length) % repository.manifest.frames.length;
    const requestId = ++requestCounter.current;
    failedRequestRef.current = null;
    dispatch({ type: 'FRAME_REQUEST', week: normalized, requestId });
    const currentMeta = repository.frameAt(normalized);
    let aborted = false;
    const handleAbort = () => {
      aborted = true;
      if (requestCounter.current !== requestId) return;
      const replacementRequestId = ++requestCounter.current;
      dispatch({ type: 'FRAME_CANCEL', requestId, replacementRequestId });
    };
    signal?.addEventListener('abort', handleAbort, { once: true });
    try {
      const current = await repository.load(currentMeta, signal);
      if (aborted || signal?.aborted || requestId !== requestCounter.current) return false;
      const pair = { current, next: current, currentMeta, nextMeta: currentMeta };
      dispatch(intent === 'reset'
        ? { type: 'RESET_SUCCESS', requestId, pair }
        : { type: 'FRAME_SUCCESS', week: normalized, requestId, pair });
      repository.prefetch(repository.frameAt(normalized - 1)); repository.prefetch(repository.frameAt(normalized + 1));
      return true;
    } catch (error: unknown) {
      if (aborted || signal?.aborted || requestId !== requestCounter.current) return false;
      failedRequestRef.current = { week: normalized, intent };
      dispatch({ type: 'FRAME_ERROR', requestId, message: error instanceof Error ? error.message : 'Unable to load frame' });
      return false;
    } finally {
      signal?.removeEventListener('abort', handleAbort);
    }
  }, []);

  const requestWeek = useCallback((week: number) => { void loadWeek(week, 'navigation'); }, [loadWeek]);
  requestWeekRef.current = requestWeek;

  const resetExplorer = useCallback((signal?: AbortSignal) => loadWeek(0, 'reset', signal), [loadWeek]);
  const retryLoad = useCallback(() => {
    const failed = failedRequestRef.current;
    if (failed) void loadWeek(failed.week, failed.intent);
  }, [loadWeek]);

  useEffect(() => {
    const controller = new AbortController();
    void loadManifest(dataBaseUrl, fetch, controller.signal).then(async (manifest) => {
      const mask = await loadMask(manifest, dataBaseUrl, fetch, controller.signal);
      repositoryRef.current = new FrameRepository(manifest, dataBaseUrl);
      dispatch({ type: 'BOOT_READY', manifest, mask });
      requestWeekRef.current(0);
      void loadGeographicIndex(import.meta.env.BASE_URL, fetch, controller.signal).then((geography) => {
        if (!controller.signal.aborted) dispatch({ type: 'GEOGRAPHY_READY', geography });
      }).catch(() => undefined);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) dispatch({ type: 'FATAL_ERROR', message: error instanceof Error ? error.message : 'Unable to initialize climate data' });
    });
    return () => controller.abort();
  }, [dataBaseUrl]);

  const actions = useMemo(() => ({
    requestWeek,
    resetExplorer,
    retryLoad,
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
  }), [requestWeek, resetExplorer, retryLoad]);

  return { state, actions, highlight: effectiveLegendSelection(state) };
}

import { useEffect, useState } from 'react';
import { CalendarDays, CircleHelp, Info, Move, RotateCcw } from 'lucide-react';
import { useClimateExplorer } from './useClimateExplorer';
import { Globe } from '../globe/Globe';
import { GlobeTooltip } from '../globe/GlobeTooltip';
import { TemperatureLegend } from '../legend/TemperatureLegend';
import { DisplayModeControl } from '../controls/DisplayModeControl';
import { RenderStyleControl } from '../controls/RenderStyleControl';
import { TimelineControl } from '../controls/TimelineControl';
import { UnitControl } from '../controls/UnitControl';
import { LayerControl } from '../controls/LayerControl';
import { ProjectionControl } from '../controls/ProjectionControl';
import { PaletteControl } from '../controls/PaletteControl';
import { formatDateRange } from '../shared/formatting';
import { TemperiesMark } from '../shared/TemperiesMark';
import { classifyClimateManifest } from '../climate/dataset';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return reduced;
}

function LoadingScreen({ error }: { error?: string }) {
  return <main className="loading-screen" role={error ? 'alert' : 'status'}><div className="loader-orbit"><TemperiesMark size={43} /></div>
    <h1>{error ? 'Data unavailable' : 'Warming up the planet'}</h1><p>{error ?? 'Validating the manifest and loading canonical 0.25° grids…'}</p>
    {error && <button onClick={() => window.location.reload()}>Try again</button>}</main>;
}

export default function App() {
  const { state, actions, highlight } = useClimateExplorer();
  const [infoPanel, setInfoPanel] = useState<'about' | 'help' | null>(null);
  const reducedMotion = useReducedMotion();
  if (state.fatalError) return <LoadingScreen error={state.fatalError} />;
  if (!state.manifest || !state.mask || !state.framePair) return <LoadingScreen />;

  const { manifest, framePair } = state;
  const frame = framePair.currentMeta;
  const datasetKind = classifyClimateManifest(manifest);
  const isReference = datasetKind === 'real-reference';
  const isSynthetic = datasetKind === 'synthetic';
  const aboutHeading = isSynthetic ? 'Synthetic architecture fixture' : isReference ? 'Verified real-data reference' : 'Validated 2025 climate data';
  const sceneDescription = isSynthetic
    ? 'One year of synthetic planetary surface conditions, mapped at quarter-degree resolution.'
    : isReference
      ? 'One verified week of ERA5 and NOAA OISST conditions, mapped at quarter-degree resolution.'
      : 'One year of ERA5 reanalysis and NOAA OISST conditions, mapped at quarter-degree resolution.';
  const readyLabel = isSynthetic ? 'SYNTHETIC DATA READY' : isReference ? 'REAL REFERENCE READY' : 'REAL 2025 DATA READY';
  const footerLabel = isSynthetic ? 'SYNTHETIC TEST DATA' : isReference ? 'REAL REFERENCE DATA' : 'REAL 2025 DATA';
  const dateRange = formatDateRange(frame.startDate, frame.endDate);
  const modeLabel = state.mode === 'composite' ? 'Surface composite' : state.mode === 'air' ? 'Land air temperature' : 'Ocean sea surface';
  const transitioning = state.loadState.status === 'loading' && state.loadState.retainingFrame;
  const loadingWeek = state.loadState.status === 'loading' ? state.loadState.requestedWeek : null;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><TemperiesMark size={37} /></span><div><strong>TEMPERIES</strong><small>GLOBAL CLIMATE OBSERVATORY</small></div></div>
      <nav aria-label="Primary"><button className="nav-active" aria-current="page">Explorer</button>
        <button className="about-nav" aria-label="About the data" onClick={() => setInfoPanel((panel) => panel === 'about' ? null : 'about')} aria-controls="information-panel" aria-expanded={infoPanel === 'about'}><span>About the data</span><Info className="mobile-nav-icon" size={19} aria-hidden="true" /></button>
        <button aria-label="How to use Temperies" aria-controls="information-panel" aria-expanded={infoPanel === 'help'} onClick={() => setInfoPanel((panel) => panel === 'help' ? null : 'help')}><CircleHelp size={19} /></button>
      </nav></header>
    {infoPanel && <aside id="information-panel" className="data-notice" role="note" aria-labelledby="information-panel-title">
      <button aria-label="Close information panel" onClick={() => setInfoPanel(null)}>×</button>
      {infoPanel === 'about' ? <><blockquote className="about-epigraph" lang="la">temperie blandarum captus aquarum<cite>Ovid, Metamorphoses IV</cite></blockquote>
        <strong id="information-panel-title">{aboutHeading}</strong><p>{manifest.notice}</p>
        <p>Land: <a href="https://cds.climate.copernicus.eu/datasets/derived-era5-single-levels-daily-statistics" target="_blank" rel="noreferrer">{manifest.sources.land.dataset}</a>, {manifest.sources.land.variable}. Ocean: <a href="https://www.ncei.noaa.gov/products/optimum-interpolation-sst" target="_blank" rel="noreferrer">{manifest.sources.ocean.dataset}</a>, {manifest.sources.ocean.variable}.</p>
        <p>The flat view uses the raster's native Plate Carrée projection. Polar screen area is enlarged by the projection; legend percentages remain cosine-of-latitude area weighted.</p></>
        : <><strong id="information-panel-title">How to explore Temperies</strong><ul>
          <li>Switch between the 3D globe and the native Plate Carrée map without changing the selected week or temperature range.</li>
          <li>Drag the globe to rotate it or drag the map to pan, then scroll or pinch to zoom.</li>
          <li>Hover either view to inspect a cell, or click or tap it to pin the details. Click or tap the globe again to close them.</li>
          <li>Hover the legend to preview a temperature band; click it to keep that band selected while changing weeks.</li>
          <li>Switch between the default blue–green–vermillion divergence, referenced to the 2025 composite median of 21.08°C, and the original sequential color scale.</li>
          <li>Use LOW or HIGH to track that spatial extreme as the selected week changes, and use Highlight band to widen the selected range.</li>
          <li>Use the arrows or period slider to request another week. The current view remains visible while the next field loads.</li>
        </ul></>}
    </aside>}
    <section className="workspace"><div className="scene-panel"><div className="scene-glow" />
      <Globe frames={framePair} mask={state.mask} mode={state.mode} renderStyle={state.renderStyle} palette={state.palette} highlight={highlight} vectorLayers={state.vectorLayers}
        projectionMode={state.projectionMode} reducedMotion={reducedMotion} onHover={actions.setHoveredCell} onLeave={() => actions.setHoveredCell(null)} onSelect={actions.toggleCellTooltip} />
      {transitioning && loadingWeek !== null && <div className="field-loading-notice" role="status" aria-live="polite">
        <span className="field-loading-spinner" aria-hidden="true" />
        <span><strong>Loading temperature data</strong><small>Preparing week {String(loadingWeek + 1).padStart(2, '0')}</small></span>
      </div>}
      <div className="scene-title"><span className="eyebrow">WEEKLY MEAN · {manifest.year}</span><h1>Earth, in temperature.</h1><p>{sceneDescription}</p></div>
      <div className="status-pill"><i /> {transitioning ? 'LOADING FIELD' : readyLabel} <span>{manifest.grid.cellCount.toLocaleString()} CELLS</span></div>
      <div className="globe-hint">{state.projectionMode === 'globe' ? <RotateCcw size={15} /> : <Move size={15} />}
        {state.projectionMode === 'globe' ? 'DRAG TO ROTATE · SCROLL TO ZOOM' : 'DRAG TO PAN · SCROLL TO ZOOM'}</div>
      <LayerControl layers={state.vectorLayers} onToggle={actions.toggleVectorLayer} />
      {state.hoveredCell && <GlobeTooltip cell={state.hoveredCell} mode={state.mode} unit={state.unit} manifest={manifest} frame={frame} pinned={state.tooltipPinned} />}
      {state.loadState.status === 'error' && state.loadState.recoverable && <div className="recoverable-error" role="alert">{state.loadState.message}<button onClick={() => actions.requestWeek(state.week)}>Retry</button></div>}
    </div>
      <TemperatureLegend histograms={frame.histograms} minimums={frame.minimums} maximums={frame.maximums} mode={state.mode} unit={state.unit} palette={state.palette} globeValue={state.hoveredCell?.temperatureC ?? null}
        hover={state.legendHover} locked={state.legendLocked} onHover={actions.setLegendHover} onLock={actions.setLegendLock} />
      <aside className="control-panel"><ProjectionControl value={state.projectionMode} onChange={actions.setProjectionMode} />
        <DisplayModeControl value={state.mode} onChange={actions.setMode} />
        <PaletteControl value={state.palette} onChange={actions.setPalette} />
        <RenderStyleControl value={state.renderStyle} onChange={actions.setRenderStyle} />
        <section className="date-section"><div><span className="eyebrow">CURRENT PERIOD</span><h2>{dateRange}</h2><p>Week {String(state.week + 1).padStart(2, '0')} of {manifest.frames.length} <b>·</b> {modeLabel}</p></div><CalendarDays size={21} /></section>
        <TimelineControl week={state.week} frameCount={manifest.frames.length} loading={transitioning} onWeek={actions.requestWeek} />
        <div className="fact-row"><div><span>GRID</span><strong>{manifest.grid.resolution}°</strong></div><div><span>FRAME</span><strong>{String(state.week + 1).padStart(2, '0')} / {manifest.frames.length}</strong></div><div><span>UNITS</span><UnitControl unit={state.unit} onChange={actions.setUnit} /></div></div>
      </aside></section>
    <footer><span><i /> {footerLabel}</span><p>Land: {manifest.sources.land.dataset} · Ocean: {manifest.sources.ocean.dataset} · Local static binaries</p>
      <nav aria-label="Project links"><a href="https://github.com/unguisdraconis/temperies/blob/main/DATA_SOURCES.md" target="_blank" rel="noreferrer">Methodology</a><a href="https://github.com/unguisdraconis/temperies" target="_blank" rel="noreferrer">Source code</a></nav><p>TEMPERIES TELLURIS</p></footer>
  </main>;
}

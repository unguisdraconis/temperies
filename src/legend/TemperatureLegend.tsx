import { useMemo, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { area, curveBasis } from 'd3-shape';
import type { DisplayMode, Extrema, FrameHistograms, LegendSelection, TemperatureUnit, TrackedExtreme } from '../climate/types';
import { ANNUAL_SCALE } from '../climate/constants';
import { celsiusToDisplay } from '../climate/temperature';
import { formatLegendValue, HIGHLIGHT_BAND_HALF_WIDTHS_C, legendScale, rangeAround, temperatureColor, temperatureFromClientX } from './legendScale';
import { extremeForMode, histogramForMode, percentageInRange } from './legendStatistics';

const WIDTH = 760; const HEIGHT = 108; const PADDING = 10;
const TICKS = [-80, -60, -40, -20, 0, 20, 40, 60];

interface Props {
  histograms: FrameHistograms; minimums: Extrema; maximums: Extrema;
  mode: DisplayMode; unit: TemperatureUnit; globeValue: number | null;
  hover: LegendSelection | null; locked: LegendSelection | null;
  onHover: (selection: LegendSelection | null) => void; onLock: (selection: LegendSelection | null) => void;
}

export function TemperatureLegend({ histograms, minimums, maximums, mode, unit, globeValue, hover, locked, onHover, onLock }: Props) {
  const [keyboardValue, setKeyboardValue] = useState(0);
  const [bandHalfWidthC, setBandHalfWidthC] = useState<number>(HIGHLIGHT_BAND_HALF_WIDTHS_C[0]);
  const x = useMemo(() => legendScale(WIDTH, PADDING), []);
  const population = histogramForMode(histograms, mode);
  const maxBin = Math.max(1, ...population.bins);
  const histogramPath = useMemo(() => area<number>()
    .x((_, index) => x(histograms.binMinimum + (index + 0.5) * histograms.binWidth))
    .y0(68).y1((value) => 68 - value / maxBin * 28).curve(curveBasis)(population.bins),
  [histograms.binMinimum, histograms.binWidth, maxBin, population.bins, x]);
  const selection = locked ?? hover;
  const marker = selection?.value ?? globeValue;
  const percentage = selection ? percentageInRange(histograms, mode, selection) : null;
  const weeklyMeanLow = extremeForMode(minimums, mode);
  const weeklyMeanHigh = extremeForMode(maximums, mode);

  const selectionAt = (value: number, isLocked: boolean, trackedExtreme?: TrackedExtreme): LegendSelection => ({
    ...rangeAround(value, bandHalfWidthC),
    locked: isLocked,
    ...(trackedExtreme ? { trackedExtreme, bandHalfWidthC } : {}),
  });
  const displayBand = (valueC: number) => unit === 'F' ? valueC * 9 / 5 : valueC;
  const formatBand = (valueC: number) => `±${displayBand(valueC).toFixed(1)}°${unit}`;
  const handleBandChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextBand = Number(event.target.value);
    setBandHalfWidthC(nextBand);
    if (locked) onLock({
      ...rangeAround(locked.value, nextBand),
      locked: true,
      ...(locked.trackedExtreme ? { trackedExtreme: locked.trackedExtreme, bandHalfWidthC: nextBand } : {}),
    });
  };
  const pointerValue = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return temperatureFromClientX(event.clientX, rect.left, rect.width, rect.height);
  };
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!locked) onHover(selectionAt(pointerValue(event), false));
  };
  const handleClick = (event: PointerEvent<SVGSVGElement>) => {
    if (locked) onLock(null);
    else onLock(selectionAt(pointerValue(event), true));
  };
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    let next = keyboardValue;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= histograms.binWidth;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += histograms.binWidth;
    else if (event.key === 'Home') next = ANNUAL_SCALE.minimum;
    else if (event.key === 'End') next = ANNUAL_SCALE.maximum;
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onLock(locked ? null : selectionAt(keyboardValue, true)); return; }
    else if (event.key === 'Escape') { onLock(null); onHover(null); return; }
    else return;
    event.preventDefault(); next = Math.min(ANNUAL_SCALE.maximum, Math.max(ANNUAL_SCALE.minimum, next));
    setKeyboardValue(next); if (!locked) onHover(selectionAt(next, false));
  };

  return <section className="legend-card" aria-label="Interactive temperature legend">
    <div className="legend-heading"><div><span className="eyebrow">TEMPERATURE DISTRIBUTION</span>
      <p>{mode === 'air' ? 'Air temperature over land' : mode === 'sst' ? 'Sea-surface temperature over ocean' : 'Land air + ocean surface composite'}</p>
      <div className="legend-extremes" role="group" aria-label="Weekly mean extremes">
        <button type="button" onClick={() => onLock(selectionAt(weeklyMeanLow, true, 'minimum'))} aria-pressed={locked?.trackedExtreme === 'minimum'} aria-label={`Track weekly mean low ${formatLegendValue(weeklyMeanLow, unit)}`}><span>LOW</span><strong>{formatLegendValue(weeklyMeanLow, unit)}</strong></button>
        <button type="button" onClick={() => onLock(selectionAt(weeklyMeanHigh, true, 'maximum'))} aria-pressed={locked?.trackedExtreme === 'maximum'} aria-label={`Track weekly mean high ${formatLegendValue(weeklyMeanHigh, unit)}`}><span>HIGH</span><strong>{formatLegendValue(weeklyMeanHigh, unit)}</strong></button>
      </div></div>
      <div className="legend-actions"><div className={`legend-readout ${selection ? 'active' : ''}`} aria-live="polite">
        {selection ? <><strong>{formatLegendValue(selection.value, unit)}</strong><span>{formatBand(bandHalfWidthC)} · {selection.trackedExtreme === 'minimum' ? 'WEEKLY LOW' : selection.trackedExtreme === 'maximum' ? 'WEEKLY HIGH' : selection.locked ? 'LOCKED' : 'HOVER'}</span></> : <><strong>—</strong><span>SELECT RANGE</span></>}
      </div><label className="legend-band"><span>Highlight band</span><select aria-label="Highlight band" value={bandHalfWidthC} onChange={handleBandChange}>
        {HIGHLIGHT_BAND_HALF_WIDTHS_C.map((halfWidth) => <option key={halfWidth} value={halfWidth}>{formatBand(halfWidth)}</option>)}
      </select></label></div></div>
    <svg className="legend-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="slider" tabIndex={0}
      aria-label="Temperature range selector" aria-valuemin={celsiusToDisplay(ANNUAL_SCALE.minimum, unit)} aria-valuemax={celsiusToDisplay(ANNUAL_SCALE.maximum, unit)}
      aria-valuenow={celsiusToDisplay(selection?.value ?? keyboardValue, unit)} aria-valuetext={formatLegendValue(selection?.value ?? keyboardValue, unit)}
      onPointerMove={handlePointerMove} onPointerLeave={() => { if (!locked) onHover(null); }} onClick={handleClick} onKeyDown={handleKeyDown}>
      <defs><linearGradient id="temp-gradient">{Array.from({ length: 15 }, (_, index) => <stop key={index} offset={`${index / 14 * 100}%`} stopColor={temperatureColor(ANNUAL_SCALE.minimum + index / 14 * (ANNUAL_SCALE.maximum - ANNUAL_SCALE.minimum))} />)}</linearGradient>
        <linearGradient id="hist-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d8f5ed" stopOpacity=".4" /><stop offset="1" stopColor="#d8f5ed" stopOpacity=".02" /></linearGradient></defs>
      {histogramPath && <path d={histogramPath} fill="url(#hist-gradient)" stroke="#d8f5ed" strokeOpacity=".32" strokeWidth="1" />}
      <rect x={PADDING} y="72" width={WIDTH - PADDING * 2} height="14" rx="7" fill="url(#temp-gradient)" />
      {TICKS.map((tick) => <g key={tick} transform={`translate(${x(tick)}, 0)`}><line y1="89" y2="94" stroke="#7d929d" /><text y="105" textAnchor="middle">{Math.round(celsiusToDisplay(tick, unit))}°</text></g>)}
      {selection && <rect x={x(selection.minimum)} y="70" width={Math.max(2, x(selection.maximum) - x(selection.minimum))} height="18" rx="4" fill="none" stroke="#fff" strokeWidth="1.5" />}
      {marker !== null && <g data-testid="temperature-marker" transform={`translate(${x(marker)}, 0)`}><path d="M0 66 L-5 58 L5 58 Z" fill="#fff" /><line y1="15" y2="58" stroke="#fff" strokeOpacity=".55" strokeDasharray="2 3" /></g>}
    </svg>
    <div className="legend-foot"><span>{Math.round(celsiusToDisplay(ANNUAL_SCALE.minimum, unit))}°{unit}</span>
      <span>{percentage === null ? `AREA-WEIGHTED ${population.label.toUpperCase()} · FIXED ANNUAL SCALE` : `≈ ${percentage.toFixed(1)}% OF ${population.label.toUpperCase()}`}</span>
      <span>+{Math.round(celsiusToDisplay(ANNUAL_SCALE.maximum, unit))}°{unit}</span></div>
    {locked && <button className="clear-selection" onClick={() => onLock(null)}>Clear selected temperature range</button>}
  </section>;
}

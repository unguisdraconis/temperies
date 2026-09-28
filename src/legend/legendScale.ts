import { scaleLinear } from 'd3-scale';
import { ANNUAL_SCALE } from '../climate/constants';
import type { TemperatureRange, TemperatureUnit } from '../climate/types';
import { celsiusToDisplay } from '../climate/temperature';
export const HIGHLIGHT_BAND_HALF_WIDTHS_C = [0.5, 1, 2.5, 5] as const;
export { createLutData, temperatureColor } from './palettes';

export function legendScale(width: number, padding: number) {
  return scaleLinear().domain([ANNUAL_SCALE.minimum, ANNUAL_SCALE.maximum]).range([padding, width - padding]).clamp(true);
}

export function pointerToTemperatureC(pointerX: number, width: number, padding: number): number {
  return legendScale(width, padding).invert(pointerX);
}

export function temperatureFromClientX(
  clientX: number,
  left: number,
  renderedWidth: number,
  renderedHeight: number,
  viewBoxWidth = 760,
  viewBoxHeight = 108,
  padding = 10,
): number {
  // SVG's default xMidYMid meet behavior preserves the viewBox aspect ratio.
  // A wide, fixed-height legend therefore has horizontal letterboxing that is
  // part of getBoundingClientRect(), but not part of the SVG coordinate space.
  const scale = Math.min(renderedWidth / viewBoxWidth, renderedHeight / viewBoxHeight);
  if (!Number.isFinite(scale) || scale <= 0) return ANNUAL_SCALE.minimum;
  const renderedContentWidth = viewBoxWidth * scale;
  const contentLeft = left + (renderedWidth - renderedContentWidth) / 2;
  const viewBoxX = (clientX - contentLeft) / scale;
  return pointerToTemperatureC(viewBoxX, viewBoxWidth, padding);
}

export function rangeAround(valueC: number, halfWidthC: number = HIGHLIGHT_BAND_HALF_WIDTHS_C[0]): TemperatureRange {
  if (!Number.isFinite(halfWidthC) || halfWidthC <= 0) throw new RangeError('highlight half-width must be positive');
  const value = Math.min(ANNUAL_SCALE.maximum, Math.max(ANNUAL_SCALE.minimum, valueC));
  return { value, minimum: Math.max(ANNUAL_SCALE.minimum, value - halfWidthC), maximum: Math.min(ANNUAL_SCALE.maximum, value + halfWidthC) };
}

export function formatLegendValue(valueC: number, unit: TemperatureUnit): string {
  return `${celsiusToDisplay(valueC, unit).toFixed(1)}°${unit}`;
}

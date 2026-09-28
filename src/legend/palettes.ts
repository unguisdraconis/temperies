import { color } from 'd3-color';
import { interpolateRgb, interpolateRgbBasis } from 'd3-interpolate';
import { ANNUAL_COMPOSITE_MEDIAN_C, ANNUAL_SCALE } from '../climate/constants';
import type { TemperaturePalette } from '../climate/types';

const SEQUENTIAL_COLORS = [
  '#28166f', '#2946b6', '#1c87d2', '#33c3ca', '#8fd28e',
  '#f3d45a', '#f59b3b', '#e75236', '#a5112d', '#5a061d',
] as const;
const sequentialInterpolator = interpolateRgbBasis([...SEQUENTIAL_COLORS]);

const DIVERGING_STOPS = [
  { temperatureC: -80, color: '#003f5c' },
  { temperatureC: -38, color: '#0072b2' },
  { temperatureC: -7.2, color: '#56b4e9' },
  { temperatureC: 8.2, color: '#2fb6a0' },
  { temperatureC: ANNUAL_COMPOSITE_MEDIAN_C, color: '#009e73' },
  { temperatureC: 37.6, color: '#e69f00' },
  { temperatureC: 51.6, color: '#d55e00' },
  { temperatureC: 60, color: '#8c2d04' },
] as const;

function clampedTemperature(valueC: number): number {
  return Math.min(ANNUAL_SCALE.maximum, Math.max(ANNUAL_SCALE.minimum, valueC));
}

function divergingColor(valueC: number): string {
  const value = clampedTemperature(valueC);
  const upperIndex = DIVERGING_STOPS.findIndex((stop) => stop.temperatureC >= value);
  if (upperIndex <= 0) return DIVERGING_STOPS[0].color;
  const lower = DIVERGING_STOPS[upperIndex - 1]!;
  const upper = DIVERGING_STOPS[upperIndex]!;
  const position = (value - lower.temperatureC) / (upper.temperatureC - lower.temperatureC);
  return interpolateRgb(lower.color, upper.color)(position);
}

export function temperatureColor(valueC: number, palette: TemperaturePalette = 'diverging'): string {
  const value = clampedTemperature(valueC);
  if (palette === 'diverging') return divergingColor(value);
  const position = (value - ANNUAL_SCALE.minimum) / (ANNUAL_SCALE.maximum - ANNUAL_SCALE.minimum);
  return sequentialInterpolator(position);
}

export function createLutData(palette: TemperaturePalette = 'diverging', size = 512): Uint8Array {
  if (!Number.isInteger(size) || size < 2) throw new RangeError('palette texture size must be an integer of at least 2');
  const bytes = new Uint8Array(size * 4);
  for (let index = 0; index < size; index += 1) {
    const temperatureC = ANNUAL_SCALE.minimum + index / (size - 1) * (ANNUAL_SCALE.maximum - ANNUAL_SCALE.minimum);
    const rgb = color(temperatureColor(temperatureC, palette))!.rgb();
    bytes[index * 4] = rgb.r;
    bytes[index * 4 + 1] = rgb.g;
    bytes[index * 4 + 2] = rgb.b;
    bytes[index * 4 + 3] = 255;
  }
  return bytes;
}

export function paletteGradientStops(palette: TemperaturePalette): Array<{ offset: number; color: string }> {
  const temperatures = Array.from({ length: 33 }, (_, index) =>
    ANNUAL_SCALE.minimum + index / 32 * (ANNUAL_SCALE.maximum - ANNUAL_SCALE.minimum));
  if (palette === 'diverging') temperatures.push(ANNUAL_COMPOSITE_MEDIAN_C);
  return temperatures.sort((left, right) => left - right).map((temperatureC) => ({
    offset: (temperatureC - ANNUAL_SCALE.minimum) / (ANNUAL_SCALE.maximum - ANNUAL_SCALE.minimum),
    color: temperatureColor(temperatureC, palette),
  }));
}

export function paletteGradientCss(palette: TemperaturePalette): string {
  const stops = paletteGradientStops(palette).map(({ offset, color: stopColor }) => `${stopColor} ${offset * 100}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

import { color } from 'd3-color';
import { describe, expect, it } from 'vitest';
import { ANNUAL_COMPOSITE_MEDIAN_C } from '../climate/constants';
import { createLutData, paletteGradientStops, temperatureColor } from './palettes';

const hex = (value: string) => color(value)!.formatHex();

describe('temperature palettes', () => {
  it('anchors the color-vision-friendly divergence at the fixed annual composite median', () => {
    expect(hex(temperatureColor(-80, 'diverging'))).toBe('#003f5c');
    expect(hex(temperatureColor(ANNUAL_COMPOSITE_MEDIAN_C, 'diverging'))).toBe('#009e73');
    expect(hex(temperatureColor(60, 'diverging'))).toBe('#8c2d04');
  });
  it('keeps the original sequential palette available', () => {
    expect(hex(temperatureColor(-80, 'sequential'))).toBe('#28166f');
    expect(hex(temperatureColor(60, 'sequential'))).toBe('#5a061d');
  });
  it('produces opaque GPU lookup data and an exact diverging reference stop', () => {
    const lut = createLutData('diverging', 16);
    expect(lut).toHaveLength(64);
    expect(Array.from({ length: 16 }, (_, index) => lut[index * 4 + 3])).toEqual(Array(16).fill(255));
    expect(paletteGradientStops('diverging')).toContainEqual(expect.objectContaining({
      offset: (ANNUAL_COMPOSITE_MEDIAN_C + 80) / 140,
    }));
  });
});

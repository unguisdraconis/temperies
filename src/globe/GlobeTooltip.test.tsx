import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../climate/manifest';
import type { HoveredCell } from '../climate/types';
import type { GeographicIndex } from '../geography/types';
import { GlobeTooltip } from './GlobeTooltip';

const manifest = parseManifest(JSON.parse(readFileSync('public/data/2025/manifest.json', 'utf8')) as unknown);
const cell = {
  row: 0,
  column: 0,
  index: 0,
  latitude: 35,
  longitude: 18,
  surface: 'ocean',
  temperatureC: 21.25,
  clientX: 200,
  clientY: 180,
  interpolation: 0,
} satisfies HoveredCell;
const geography = {
  cells: new Uint16Array([1]),
  places: [null, { id: 1, kind: 'marine', name: 'Mediterranean Sea', type: 'Sea' }],
} satisfies GeographicIndex;

describe('globe tooltip', () => {
  it('shows the resolved geographic feature in the hover and pinned card', () => {
    render(<GlobeTooltip cell={cell} mode="composite" unit="C" manifest={manifest} frame={manifest.frames[0]!} geography={geography} pinned />);
    expect(screen.getByText('SEA')).toBeInTheDocument();
    expect(screen.getByText('Mediterranean Sea')).toBeInTheDocument();
    expect(screen.getByText('PINNED · TAP GLOBE TO CLOSE')).toBeInTheDocument();
  });
});

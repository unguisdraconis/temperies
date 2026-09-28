import type { CSSProperties } from 'react';
import { ANNUAL_COMPOSITE_MEDIAN_C } from '../climate/constants';
import type { TemperaturePalette } from '../climate/types';
import { paletteGradientCss } from '../legend/palettes';

const OPTIONS: ReadonlyArray<{ id: TemperaturePalette; label: string }> = [
  { id: 'diverging', label: 'Diverging' },
  { id: 'sequential', label: 'Sequential' },
];

export function PaletteControl({ value, onChange }: { value: TemperaturePalette; onChange: (palette: TemperaturePalette) => void }) {
  return <section className="control-section palette-control"><span className="eyebrow">COLOR SCALE</span>
    <div className="segmented palette-switch" role="group" aria-label="Temperature color scale">
      {OPTIONS.map((option) => <button type="button" key={option.id} aria-pressed={value === option.id}
        className={value === option.id ? 'active' : ''} onClick={() => onChange(option.id)}>
        <i className="palette-swatch" aria-hidden="true" style={{ '--palette-gradient': paletteGradientCss(option.id) } as CSSProperties} />
        {option.label}
      </button>)}
    </div>
    <p>{value === 'diverging' ? `Reference ${ANNUAL_COMPOSITE_MEDIAN_C.toFixed(2)}°C · 2025 composite median` : 'Original fixed annual sequence'}</p>
  </section>;
}

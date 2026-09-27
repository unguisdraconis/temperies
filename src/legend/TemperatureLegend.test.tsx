import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FrameHistograms, LegendSelection } from '../climate/types';
import { TemperatureLegend } from './TemperatureLegend';

const bins = Array.from({ length: 280 }, () => 1);
const histograms: FrameHistograms = { binMinimum: -80, binWidth: 0.5, areaTotal: 280, landArea: 280, oceanArea: 280, land: bins, ocean: bins, combined: bins };
const props = {
  histograms,
  minimums: { combined: -47, land: -47, ocean: -1.8 },
  maximums: { combined: 36.14, land: 36.14, ocean: 32.59 },
  mode: 'composite' as const, unit: 'C' as const, globeValue: 12, hover: null, locked: null,
};

describe('TemperatureLegend interaction', () => {
  it('creates transient pointer ranges and locks them on activation', () => {
    const onHover = vi.fn(); const onLock = vi.fn();
    render(<TemperatureLegend {...props} onHover={onHover} onLock={onLock} />);
    const slider = screen.getByRole('slider');
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 760, top: 0, bottom: 108, right: 760, height: 108, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(slider, { clientX: 380 });
    expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ locked: false, value: -10 }));
    fireEvent.click(slider, { clientX: 380 });
    expect(onLock).toHaveBeenCalledWith(expect.objectContaining({ locked: true, value: -10 }));
  });
  it('keeps pointer values aligned when a wide legend is letterboxed', () => {
    const onHover = vi.fn();
    render(<TemperatureLegend {...props} onHover={onHover} onLock={vi.fn()} />);
    const slider = screen.getByRole('slider');
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 1000, top: 0, bottom: 72, right: 1100, height: 72, x: 100, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(slider, { clientX: 600 });
    expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ value: -10 }));
  });
  it('supports arrow keys, lock, and clear', async () => {
    const user = userEvent.setup(); const onHover = vi.fn(); const onLock = vi.fn();
    const { rerender } = render(<TemperatureLegend {...props} onHover={onHover} onLock={onLock} />); const slider = screen.getByRole('slider');
    slider.focus(); await user.keyboard('{ArrowRight}{Enter}');
    expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ value: 0.5 })); expect(onLock).toHaveBeenCalledWith(expect.objectContaining({ locked: true, value: 0.5 }));
    const locked = { value: 0.5, minimum: 0, maximum: 1, locked: true } satisfies LegendSelection;
    rerender(<TemperatureLegend {...props} locked={locked} onHover={onHover} onLock={onLock} />);
    await user.click(screen.getByRole('button', { name: /clear selected/i })); expect(onLock).toHaveBeenLastCalledWith(null);
  });
  it('widens a locked highlight band without changing its center', async () => {
    const user = userEvent.setup(); const onLock = vi.fn();
    const locked = { value: 20, minimum: 19.5, maximum: 20.5, locked: true } satisfies LegendSelection;
    render(<TemperatureLegend {...props} locked={locked} onHover={vi.fn()} onLock={onLock} />);
    await user.selectOptions(screen.getByRole('combobox', { name: /highlight band/i }), '2.5');
    expect(onLock).toHaveBeenLastCalledWith({ value: 20, minimum: 17.5, maximum: 22.5, locked: true });
  });
  it('locks the current mode weekly-mean low and high using the active band', async () => {
    const user = userEvent.setup(); const onLock = vi.fn();
    render(<TemperatureLegend {...props} onHover={vi.fn()} onLock={onLock} />);
    await user.selectOptions(screen.getByRole('combobox', { name: /highlight band/i }), '2.5');
    await user.click(screen.getByRole('button', { name: /track weekly mean low/i }));
    expect(onLock).toHaveBeenLastCalledWith({ value: -47, minimum: -49.5, maximum: -44.5, locked: true, trackedExtreme: 'minimum', bandHalfWidthC: 2.5 });
    await user.click(screen.getByRole('button', { name: /track weekly mean high/i }));
    expect(onLock).toHaveBeenLastCalledWith({ value: 36.14, minimum: 33.64, maximum: 38.64, locked: true, trackedExtreme: 'maximum', bandHalfWidthC: 2.5 });
  });
  it('preserves extreme tracking when its highlight band changes', async () => {
    const user = userEvent.setup(); const onLock = vi.fn();
    const locked = { value: -47, minimum: -47.5, maximum: -46.5, locked: true, trackedExtreme: 'minimum', bandHalfWidthC: 0.5 } satisfies LegendSelection;
    render(<TemperatureLegend {...props} locked={locked} onHover={vi.fn()} onLock={onLock} />);
    expect(screen.getByRole('button', { name: /track weekly mean low/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('±0.5°C · WEEKLY LOW')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: /highlight band/i }), '5');
    expect(onLock).toHaveBeenLastCalledWith({ value: -47, minimum: -52, maximum: -42, locked: true, trackedExtreme: 'minimum', bandHalfWidthC: 5 });
  });
  it('exposes Fahrenheit slider values and a globe-hover marker', () => {
    render(<TemperatureLegend {...props} unit="F" globeValue={20} onHover={vi.fn()} onLock={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemin', '-112');
    expect(screen.getByRole('option', { name: '±0.9°F' })).toBeInTheDocument();
    expect(screen.getByTestId('temperature-marker')).toBeInTheDocument();
  });
});

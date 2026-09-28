import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaletteControl } from './PaletteControl';

describe('PaletteControl', () => {
  it('selects between diverging and sequential color scales', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PaletteControl value="diverging" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Diverging' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/reference 21.08/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sequential' }));
    expect(onChange).toHaveBeenCalledWith('sequential');
  });
});

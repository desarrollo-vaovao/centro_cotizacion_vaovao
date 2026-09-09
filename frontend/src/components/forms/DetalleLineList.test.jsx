import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetalleLineList } from './DetalleLineList.jsx';

describe('DetalleLineList', () => {
  it('adds a new empty line', async () => {
    const onChange = vi.fn();
    render(<DetalleLineList value={['Edición de 6 videos']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '+ Agregar línea' }));
    expect(onChange).toHaveBeenCalledWith(['Edición de 6 videos', '']);
  });

  it('removes a line', async () => {
    const onChange = vi.fn();
    render(<DetalleLineList value={['Línea 1', 'Línea 2']} onChange={onChange} />);
    const removeButtons = screen.getAllByRole('button', { name: '×' });
    await userEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(['Línea 2']);
  });

  it('edits a line', async () => {
    const onChange = vi.fn();
    render(<DetalleLineList value={['']} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(onChange).toHaveBeenLastCalledWith(['x']);
  });
});

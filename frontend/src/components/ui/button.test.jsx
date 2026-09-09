import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button.jsx';

describe('Button', () => {
  it('renders its children and responds to clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies the danger variant class', () => {
    render(<Button variant="danger">Borrar</Button>);
    expect(screen.getByRole('button', { name: 'Borrar' })).toHaveClass('text-danger');
  });
});

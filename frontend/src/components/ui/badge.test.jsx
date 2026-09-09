import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge.jsx';

describe('Badge', () => {
  it('renders the label and a status-specific class', () => {
    render(<Badge status="Aprobada">Aprobada</Badge>);
    const el = screen.getByText('Aprobada');
    expect(el).toHaveClass('bg-success/10');
  });
});

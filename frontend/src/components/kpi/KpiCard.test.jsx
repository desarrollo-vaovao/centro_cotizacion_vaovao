import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from './KpiCard.jsx';

describe('KpiCard', () => {
  it('renders the label and value', () => {
    render(<KpiCard label="Cotizado este mes" value="Q5,000.00" />);
    expect(screen.getByText('Cotizado este mes')).toBeInTheDocument();
    expect(screen.getByText('Q5,000.00')).toBeInTheDocument();
  });
});

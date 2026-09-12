import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard, DollarIcon } from './KpiCard.jsx';

describe('KpiCard', () => {
  it('renders the label and value', () => {
    render(<KpiCard label="Cotizado este mes" value="Q5,000.00" />);
    expect(screen.getByText('Cotizado este mes')).toBeInTheDocument();
    expect(screen.getByText('Q5,000.00')).toBeInTheDocument();
  });

  it('renders the icon badge when given one', () => {
    const { container } = render(<KpiCard label="Cotizado" value="Q5,000.00" icon={<DollarIcon />} color="indigo" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders no icon badge when none is given', () => {
    const { container } = render(<KpiCard label="Cotizado" value="Q5,000.00" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});

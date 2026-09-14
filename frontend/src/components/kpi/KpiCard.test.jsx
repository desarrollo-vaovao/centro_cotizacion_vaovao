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

  it('shows no delta badge when delta is null or undefined', () => {
    render(<KpiCard label="Cotizado" value="Q5,000.00" delta={null} />);
    expect(screen.queryByTitle('vs. periodo anterior')).not.toBeInTheDocument();
  });

  it('shows a green up delta for a positive change by default', () => {
    render(<KpiCard label="Cotizado" value="Q5,000.00" delta={15} />);
    const badge = screen.getByTitle('vs. periodo anterior');
    expect(badge).toHaveTextContent('+15%');
    expect(badge.className).toContain('text-success');
  });

  it('shows a red down delta for a negative change by default', () => {
    render(<KpiCard label="Cotizado" value="Q5,000.00" delta={-8} />);
    const badge = screen.getByTitle('vs. periodo anterior');
    expect(badge).toHaveTextContent('-8%');
    expect(badge.className).toContain('text-danger');
  });

  it('inverts the color reading for metrics where lower is better', () => {
    // Fewer días to close (a negative delta) is the improvement here, so it
    // should read as green even though the number itself is negative.
    render(<KpiCard label="Cierre de cotización" value="2 días" delta={-20} invert />);
    const badge = screen.getByTitle('vs. periodo anterior');
    expect(badge.className).toContain('text-success');
  });

  it('uses the given unit, e.g. percentage points for tasa', () => {
    render(<KpiCard label="Tasa de aprobación" value="80%" delta={5} deltaUnit=" pts" />);
    expect(screen.getByTitle('vs. periodo anterior')).toHaveTextContent('+5 pts');
  });

  it('shows a neutral, arrow-less badge for a zero delta', () => {
    render(<KpiCard label="Cotizado" value="Q5,000.00" delta={0} />);
    const badge = screen.getByTitle('vs. periodo anterior');
    expect(badge).toHaveTextContent('0%');
    expect(badge.className).toContain('text-text-secondary');
    expect(badge.querySelector('svg')).not.toBeInTheDocument();
  });
});

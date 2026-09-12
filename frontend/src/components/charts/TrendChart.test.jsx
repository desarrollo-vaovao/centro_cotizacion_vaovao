import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TrendChart } from './TrendChart.jsx';

let lastProps;
vi.mock('react-chartjs-2', () => ({
  Bar: (props) => { lastProps = props; return <div>chart:bar</div>; }
}));

describe('TrendChart', () => {
  it('renders one bar per period, in the order given, without stacking the estatus segments', () => {
    render(<TrendChart data={[
      { period: '2026-08', aprobado: 100, enProceso: 50, denegado: 0 },
      { period: '2026-09', aprobado: 200, enProceso: 0, denegado: 30 }
    ]} />);

    expect(lastProps.data.labels).toEqual(['2026-08', '2026-09']);
    expect(lastProps.data.datasets.map((d) => d.label)).toEqual(['Aprobado', 'En proceso', 'Denegado']);
    expect(lastProps.data.datasets[0].data).toEqual([100, 200]);
    // Grouped, not stacked — each estatus should render as its own bar
    // per period instead of segments piled into a single column.
    expect(lastProps.options.scales.x.stacked).toBe(false);
    expect(lastProps.options.scales.y.stacked).toBe(false);
  });
});

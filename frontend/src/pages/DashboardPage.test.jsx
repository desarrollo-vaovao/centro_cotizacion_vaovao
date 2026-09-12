import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { DashboardPage } from './DashboardPage.jsx';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn() } }));
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div>chart:bar</div>,
  Doughnut: () => <div>chart:doughnut</div>
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><DashboardPage /></QueryClientProvider>);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path.startsWith('/dashboard')) return Promise.resolve({
        period: 'mes',
        kpis: { montoPeriodo: 3100, montoAprobado: 3100, montoPerdido: 0, avgAprob: 2, avgCierre: null, tasa: 100 },
        lineas: [['Video', 3100]],
        clientes: [['C807 Operador', { count: 1, monto: 3100 }]],
        ejecutivos: [['Marco Ramírez', { count: 1, monto: 3100 }]],
        tendencia: [{ period: '2026-07', aprobado: 3100, enProceso: 0, denegado: 0 }]
      });
      return Promise.resolve([]);
    });
  });

  it('renders the KPI tiles from the dashboard endpoint', async () => {
    renderPage();
    // Both "Cotizado" and "Aprobado (a facturar)" KPIs share this value in the
    // fixture (montoPeriodo === montoAprobado === 3100), so multiple tiles
    // legitimately render the same text.
    expect((await screen.findAllByText('Q3,100.00')).length).toBeGreaterThan(0);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders the ranking of executives', async () => {
    renderPage();
    expect(await screen.findByText('Marco Ramírez')).toBeInTheDocument();
  });

  it('requests the trend at the selected granularity', async () => {
    renderPage();
    await screen.findAllByText('chart:bar');
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('trendGranularity=mes'));

    api.get.mockClear();
    await userEvent.selectOptions(screen.getByLabelText('Agrupar tendencia por'), 'semana');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('trendGranularity=semana')));
  });
});

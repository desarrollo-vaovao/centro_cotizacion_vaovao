import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FichaClientePage } from './FichaClientePage.jsx';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><FichaClientePage /></MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FichaClientePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 2 }]);
      if (path.startsWith('/dashboard/cliente/')) return Promise.resolve({ period: 'mes', count: 2, kpis: { montoPeriodo: 5000, montoAprobado: 3000, montoPerdido: 0, tasa: 100 }, lineas: [['Video', 5000]] });
      if (path.startsWith('/quotations')) return Promise.resolve([
        { id: 1, correlativo_general: 'PC-2026-001', fecha: '2026-07-10', client_id: 1, proyecto: 'Contenidos', linea_servicio: 'Video', monto: '3100', impuestos: '372', moneda: 'GTQ', estatus: 'Aprobada', version: 1 }
      ]);
      return Promise.resolve([]);
    });
  });

  it('shows a prompt before a client is selected', async () => {
    renderPage();
    expect(await screen.findByText('Selecciona un cliente para ver su histórico.')).toBeInTheDocument();
    // No quotations should be fetched until a client is actually picked.
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/quotations'));
  });

  it('loads client KPIs after selecting a client', async () => {
    renderPage();
    const select = await screen.findByLabelText('Cliente');
    await screen.findByRole('option', { name: 'C807 Operador' });
    await userEvent.selectOptions(select, '1');
    expect(await screen.findByText('Q5,000.00')).toBeInTheDocument();
  });

  it("lists the client's own quotations, scoped by clientId", async () => {
    renderPage();
    const select = await screen.findByLabelText('Cliente');
    await screen.findByRole('option', { name: 'C807 Operador' });
    await userEvent.selectOptions(select, '1');
    expect(await screen.findByText('Cotizaciones de C807 Operador')).toBeInTheDocument();
    expect(screen.getByText('PC-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Contenidos')).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('clientId=1'));
  });

  it('shows an empty state when the client has no quotations', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 2 }]);
      if (path.startsWith('/dashboard/cliente/')) return Promise.resolve({ period: 'mes', count: 0, kpis: { montoPeriodo: 0, montoAprobado: 0, montoPerdido: 0, tasa: null }, lineas: [] });
      return Promise.resolve([]);
    });
    renderPage();
    const select = await screen.findByLabelText('Cliente');
    await screen.findByRole('option', { name: 'C807 Operador' });
    await userEvent.selectOptions(select, '1');
    expect(await screen.findByText('Este cliente no tiene cotizaciones todavía.')).toBeInTheDocument();
  });
});

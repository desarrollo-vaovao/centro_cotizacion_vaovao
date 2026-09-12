import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HistorialPage } from './HistorialPage.jsx';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><HistorialPage /></MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HistorialPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path.startsWith('/quotations')) return Promise.resolve([
        { id: 1, correlativo_general: 'PC-2026-001', fecha: '2026-07-10', client_id: 1, cliente_nombre_libre: null, proyecto: 'Contenidos', executive_id: 1, linea_servicio: 'Video', monto: '3100', impuestos: '372', moneda: 'GTQ', estatus: 'Enviada', version: 1, superseded_by: null, fecha_aprobacion: null, fecha_cierre_proyecto: null },
        { id: 2, correlativo_general: 'PC-2026-002', fecha: '2026-08-05', client_id: 1, cliente_nombre_libre: null, proyecto: 'Redes', executive_id: 1, linea_servicio: 'Fotografía', monto: '1000', impuestos: '120', moneda: 'GTQ', estatus: 'Aprobada', version: 1, superseded_by: null, fecha_aprobacion: null, fecha_cierre_proyecto: null }
      ]);
      if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 1 }]);
      if (path === '/executives') return Promise.resolve([{ id: 1, name: 'Marco Ramírez' }]);
      if (path === '/service-lines') return Promise.resolve([{ id: 1, name: 'Video', sort_order: 0 }, { id: 2, name: 'Fotografía', sort_order: 1 }]);
      return Promise.resolve([]);
    });
  });

  it('lists quotations with client and executive names resolved', async () => {
    renderPage();
    expect(await screen.findByText('PC-2026-001')).toBeInTheDocument();
    const table = screen.getByRole('table');
    // Both fixture quotations share the same client and executive, so both
    // rows resolve the same names — assert at least one row shows each.
    expect(within(table).getAllByText('C807 Operador').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Marco Ramírez').length).toBeGreaterThan(0);
  });

  it('changes status via the inline select, calling PATCH', async () => {
    api.patch.mockResolvedValue({ id: 1, estatus: 'Aprobada', monto: '3100', impuestos: '372' });
    renderPage();
    await screen.findByText('PC-2026-001');
    await userEvent.selectOptions(screen.getByLabelText('Estatus de PC-2026-001'), 'Aprobada');
    expect(api.patch).toHaveBeenCalledWith('/quotations/1', { estatus: 'Aprobada' });
  });

  it('colors the status select according to the current estatus', async () => {
    renderPage();
    await screen.findByText('PC-2026-001');
    // Enviada -> the info palette; Aprobada -> the success palette. Checking
    // for the class names keeps this in sync with badge.jsx's STATUS_CLASSES
    // without hardcoding hex values here.
    expect(screen.getByLabelText('Estatus de PC-2026-001').className).toContain('text-info');
    expect(screen.getByLabelText('Estatus de PC-2026-002').className).toContain('text-success');
  });

  it('filters by línea de servicio', async () => {
    renderPage();
    await screen.findByText('PC-2026-001');
    expect(screen.getByText('PC-2026-002')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por línea de servicio'), 'Fotografía');
    expect(screen.queryByText('PC-2026-001')).not.toBeInTheDocument();
    expect(screen.getByText('PC-2026-002')).toBeInTheDocument();
  });

  it('filters by a date range', async () => {
    renderPage();
    await screen.findByText('PC-2026-001');
    const desde = document.getElementById('hist_desde');
    await userEvent.type(desde, '2026-08-01');
    expect(screen.queryByText('PC-2026-001')).not.toBeInTheDocument();
    expect(screen.getByText('PC-2026-002')).toBeInTheDocument();
  });

  it('shows a clear-filters button only once a filter is active, and it resets everything', async () => {
    renderPage();
    await screen.findByText('PC-2026-001');
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por línea de servicio'), 'Fotografía');
    expect(screen.queryByText('PC-2026-001')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByLabelText('Filtrar por línea de servicio')).toHaveValue('');
    expect(await screen.findByText('PC-2026-001')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });
});

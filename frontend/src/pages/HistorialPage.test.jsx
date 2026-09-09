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
        { id: 1, correlativo_general: 'PC-2026-001', fecha: '2026-07-10', client_id: 1, cliente_nombre_libre: null, proyecto: 'Contenidos', executive_id: 1, linea_servicio: 'Video', monto: '3100', impuestos: '372', moneda: 'GTQ', estatus: 'Enviada', version: 1, superseded_by: null, fecha_aprobacion: null, fecha_cierre_proyecto: null }
      ]);
      if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 1 }]);
      if (path === '/executives') return Promise.resolve([{ id: 1, name: 'Marco Ramírez' }]);
      return Promise.resolve([]);
    });
  });

  it('lists quotations with client and executive names resolved', async () => {
    renderPage();
    expect(await screen.findByText('PC-2026-001')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('C807 Operador')).toBeInTheDocument();
    expect(within(table).getByText('Marco Ramírez')).toBeInTheDocument();
  });

  it('changes status via the inline select, calling PATCH', async () => {
    api.patch.mockResolvedValue({ id: 1, estatus: 'Aprobada', monto: '3100', impuestos: '372' });
    renderPage();
    await screen.findByText('PC-2026-001');
    await userEvent.selectOptions(screen.getByLabelText('Estatus de PC-2026-001'), 'Aprobada');
    expect(api.patch).toHaveBeenCalledWith('/quotations/1', { estatus: 'Aprobada' });
  });
});

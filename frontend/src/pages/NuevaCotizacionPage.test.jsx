import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NuevaCotizacionPage } from './NuevaCotizacionPage.jsx';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

function renderPage(initialPath = '/nueva') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/nueva" element={<NuevaCotizacionPage />} />
          <Route path="/ajustar/:id" element={<NuevaCotizacionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NuevaCotizacionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 1 }]);
      if (path === '/executives') return Promise.resolve([{ id: 1, name: 'Marco Ramírez' }]);
      if (path === '/service-lines') return Promise.resolve([{ id: 1, name: 'Video', sort_order: 0 }]);
      return Promise.resolve([]);
    });
  });

  it('shows a validation error when submitting without a project name', async () => {
    renderPage();
    await screen.findByText('C807 Operador');
    // Client and executive are selected first so the project-name check is
    // the one that actually fires — validation runs client, then executive,
    // then project, in that order, matching the backend's own order.
    await userEvent.selectOptions(screen.getByLabelText('Cliente'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Ejecutivo comercial'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Generar cotización' }));
    expect(await screen.findByText('Ingresa el nombre del proyecto.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits a valid quotation', async () => {
    api.post.mockResolvedValue({ id: 9, monto: '100', impuestos: '12' });
    renderPage();
    await screen.findByText('C807 Operador');
    await userEvent.selectOptions(screen.getByLabelText('Cliente'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Ejecutivo comercial'), '1');
    await userEvent.type(screen.getByLabelText('Proyecto'), 'Contenidos de agosto');
    await userEvent.type(screen.getByPlaceholderText('Ej. Edición de 6 videos para redes sociales'), 'Edición');
    await userEvent.type(screen.getByLabelText('Monto (antes de impuestos)'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Generar cotización' }));
    expect(api.post).toHaveBeenCalledWith('/quotations', expect.objectContaining({ proyecto: 'Contenidos de agosto', clientId: '1', executiveId: '1' }));
  });
});

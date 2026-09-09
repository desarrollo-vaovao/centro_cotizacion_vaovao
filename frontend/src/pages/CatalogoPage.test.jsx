import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { CatalogoPage } from './CatalogoPage.jsx';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CatalogoPage />
    </QueryClientProvider>
  );
}

describe('CatalogoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 2 }]);
      if (path === '/executives') return Promise.resolve([{ id: 1, name: 'Marco Ramírez' }]);
      if (path === '/service-lines') return Promise.resolve([{ id: 1, name: 'Video', sort_order: 0 }]);
      if (path === '/settings/logos') return Promise.resolve({ logo_agencia: null, logo_velarc: null });
      return Promise.resolve([]);
    });
  });

  it('lists existing clients, executives, and service lines', async () => {
    renderPage();
    expect(await screen.findByText('C807 Operador')).toBeInTheDocument();
    expect(screen.getByText('Marco Ramírez')).toBeInTheDocument();
    // Service line names render as the value of an editable (rename-on-blur)
    // input, not as plain text — getByDisplayValue is the correct query.
    expect(screen.getByDisplayValue('Video')).toBeInTheDocument();
  });

  it('creates a new executive', async () => {
    api.post.mockResolvedValue({ id: 2, name: 'Mishel Velez' });
    renderPage();
    await screen.findByText('C807 Operador');
    await userEvent.type(screen.getByLabelText('Nombre del ejecutivo'), 'Mishel Velez');
    await userEvent.click(screen.getByRole('button', { name: '+ Agregar ejecutivo' }));
    expect(api.post).toHaveBeenCalledWith('/executives', { name: 'Mishel Velez' });
  });
});

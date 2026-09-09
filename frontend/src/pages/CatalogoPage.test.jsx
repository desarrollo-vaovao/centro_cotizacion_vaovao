import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('deletes a client after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.delete.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('C807 Operador');
    await userEvent.click(screen.getByLabelText('Eliminar cliente C807 Operador'));
    expect(window.confirm).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('/clients/1');
  });

  it('does not delete a client when the confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await screen.findByText('C807 Operador');
    await userEvent.click(screen.getByLabelText('Eliminar cliente C807 Operador'));
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('shows an error when a client cannot be deleted because it has quotations', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.delete.mockRejectedValue(new Error('No se puede eliminar: el cliente tiene cotizaciones asociadas.'));
    renderPage();
    await screen.findByText('C807 Operador');
    await userEvent.click(screen.getByLabelText('Eliminar cliente C807 Operador'));
    expect(await screen.findByText('No se puede eliminar: el cliente tiene cotizaciones asociadas.')).toBeInTheDocument();
  });

  it('creates a new executive', async () => {
    api.post.mockResolvedValue({ id: 2, name: 'Mishel Velez' });
    renderPage();
    await screen.findByText('C807 Operador');
    await userEvent.type(screen.getByLabelText('Nombre del ejecutivo'), 'Mishel Velez');
    await userEvent.click(screen.getByRole('button', { name: '+ Agregar ejecutivo' }));
    expect(api.post).toHaveBeenCalledWith('/executives', { name: 'Mishel Velez' });
  });

  it('uploads a logo whose base64 data URI fits the size limit', async () => {
    api.put.mockResolvedValue({ logo_agencia: 'data:image/png;base64,AAAA', logo_velarc: null });
    renderPage();
    await screen.findByText('C807 Operador');

    const file = new File(['a small logo'], 'logo.png', { type: 'image/png' });
    const input = screen.getByLabelText('Subir Logo de la agencia');
    await userEvent.upload(input, file);

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [path, payload] = api.put.mock.calls[0];
    expect(path).toBe('/settings/logos');
    expect(payload.logoAgencia.startsWith('data:image/png;base64,')).toBe(true);
    expect(screen.queryByText(/máx\. ~1\.5MB/)).not.toBeInTheDocument();
  });

  it('shows an error and does not save when the encoded logo exceeds the size limit', async () => {
    renderPage();
    await screen.findByText('C807 Operador');

    // 1.5MB raw bytes → base64 encoding (~1.33x) plus the data URI prefix
    // pushes the encoded string over MAX_LOGO_BYTES, even though the raw
    // file itself is right at the limit.
    const bigContent = 'x'.repeat(1.5 * 1024 * 1024);
    const file = new File([bigContent], 'logo.png', { type: 'image/png' });
    const input = screen.getByLabelText('Subir Logo de la agencia');
    await userEvent.upload(input, file);

    await waitFor(() => expect(screen.getByText(/máx\. ~1\.5MB/)).toBeInTheDocument());
    expect(api.put).not.toHaveBeenCalled();
  });

  it('surfaces a server-side rejection of the logo save via the onError callback', async () => {
    api.put.mockRejectedValue(new Error('La imagen es muy pesada.'));
    renderPage();
    await screen.findByText('C807 Operador');

    const file = new File(['a small logo'], 'logo.png', { type: 'image/png' });
    const input = screen.getByLabelText('Subir Logo de la agencia');
    await userEvent.upload(input, file);

    await waitFor(() => expect(screen.getByText('La imagen es muy pesada.')).toBeInTheDocument());
  });
});

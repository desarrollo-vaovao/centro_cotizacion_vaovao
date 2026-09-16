import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { CatalogoPage } from './CatalogoPage.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { api } from '../lib/apiClient.js';

vi.mock('../lib/apiClient.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <CatalogoPage />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function mockGetImplementation({ role = 'owner', users = [{ id: 1, name: 'Admin Owner', email: 'admin@vaovao.co', role: 'owner' }, { id: 2, name: 'Marco Ramírez', email: 'marco@vaovao.co', role: 'executive' }] } = {}) {
  api.get.mockImplementation((path) => {
    if (path === '/auth/me') return Promise.resolve({ user: { id: 1, email: 'admin@vaovao.co', name: 'Admin Owner', role, mustChangePassword: false }, csrfToken: 'tok' });
    if (path === '/clients') return Promise.resolve([{ id: 1, code: 'C807', name: 'C807 Operador', country: 'Guatemala', contact_name: null, contact_email: null, contact_phone: null, seq: 2 }]);
    if (path === '/executives') return Promise.resolve(users);
    if (path === '/service-lines') return Promise.resolve([{ id: 1, name: 'Video', sort_order: 0 }]);
    if (path === '/settings/logos') return Promise.resolve({ logo_agencia: null, logo_velarc: null });
    return Promise.resolve([]);
  });
}

describe('CatalogoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetImplementation();
  });

  it('lists existing clients, users, and service lines', async () => {
    renderPage();
    expect(await screen.findByText('C807 Operador')).toBeInTheDocument();
    expect(screen.getByText('Marco Ramírez')).toBeInTheDocument();
    expect(screen.getByText('marco@vaovao.co')).toBeInTheDocument();
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

  it('saves a new client with code, country and contact fields', async () => {
    api.post.mockResolvedValue({ id: 2, code: 'TIENDA', name: 'Tengo Tienda', country: 'Honduras', contact_name: 'Juana Pérez', contact_email: 'juana@tienda.com', contact_phone: '5555-1234', seq: 0 });
    renderPage();
    await screen.findByText('C807 Operador');

    await userEvent.type(screen.getByLabelText('Nombre del cliente'), 'Tengo Tienda');
    await userEvent.type(screen.getByLabelText('Código del cliente'), 'tienda');
    await userEvent.selectOptions(screen.getByLabelText('País del cliente'), 'Honduras');
    await userEvent.type(screen.getByLabelText('Contacto del cliente'), 'Juana Pérez');
    await userEvent.type(screen.getByLabelText('Correo del cliente'), 'juana@tienda.com');
    await userEvent.type(screen.getByLabelText('Teléfono del cliente'), '5555-1234');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    expect(api.post).toHaveBeenCalledWith('/clients', {
      name: 'Tengo Tienda',
      code: 'tienda',
      country: 'Honduras',
      contactName: 'Juana Pérez',
      contactEmail: 'juana@tienda.com',
      contactPhone: '5555-1234'
    });
  });

  it('shows an error when saving a new client fails', async () => {
    api.post.mockRejectedValue(new Error('Ese código de cliente ya existe.'));
    renderPage();
    await screen.findByText('C807 Operador');
    await userEvent.type(screen.getByLabelText('Nombre del cliente'), 'Tengo Tienda');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
    expect(await screen.findByText('Ese código de cliente ya existe.')).toBeInTheDocument();
  });

  it('an owner can create a new user and sees the one-time temporary password', async () => {
    api.post.mockResolvedValue({ id: 3, name: 'Mishel Velez', email: 'mishel@vaovao.co', role: 'executive', tempPassword: 'Ab3dEfGhJk9m' });
    renderPage();
    await screen.findByText('C807 Operador');

    await userEvent.type(screen.getByLabelText('Nombre del usuario'), 'Mishel Velez');
    await userEvent.type(screen.getByLabelText('Correo del usuario'), 'mishel@vaovao.co');
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(api.post).toHaveBeenCalledWith('/executives', { name: 'Mishel Velez', email: 'mishel@vaovao.co' });
    expect(await screen.findByText('mishel@vaovao.co', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Ab3dEfGhJk9m')).toBeInTheDocument();
  });

  it('shows an error when creating a new user fails', async () => {
    api.post.mockRejectedValue(new Error('Ese correo ya está en uso.'));
    renderPage();
    await screen.findByText('C807 Operador');
    await userEvent.type(screen.getByLabelText('Nombre del usuario'), 'Mishel Velez');
    await userEvent.type(screen.getByLabelText('Correo del usuario'), 'marco@vaovao.co');
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    expect(await screen.findByText('Ese correo ya está en uso.')).toBeInTheDocument();
  });

  it('an owner can reset another user\'s password and sees the new one-time temporary password', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.post.mockResolvedValue({ tempPassword: 'Zz2xCvBnMq7w' });
    renderPage();
    await screen.findByText('Marco Ramírez');
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña de Marco Ramírez' }));
    expect(api.post).toHaveBeenCalledWith('/executives/2/reset-password');
    expect(await screen.findByText('Zz2xCvBnMq7w')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText('Zz2xCvBnMq7w')).not.toBeInTheDocument();
  });

  it('deletes a user after confirming (not shown for your own row)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.delete.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Marco Ramírez');
    expect(screen.queryByLabelText('Eliminar usuario Admin Owner')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Eliminar usuario Marco Ramírez'));
    expect(window.confirm).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('/executives/2');
  });

  it('does not delete a user when the confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await screen.findByText('Marco Ramírez');
    await userEvent.click(screen.getByLabelText('Eliminar usuario Marco Ramírez'));
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('shows an error when a user cannot be deleted because it has quotations', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.delete.mockRejectedValue(new Error('No se puede eliminar: el usuario tiene cotizaciones asociadas.'));
    renderPage();
    await screen.findByText('Marco Ramírez');
    await userEvent.click(screen.getByLabelText('Eliminar usuario Marco Ramírez'));
    expect(await screen.findByText('No se puede eliminar: el usuario tiene cotizaciones asociadas.')).toBeInTheDocument();
  });

  it('hides all account-management controls from a non-owner, but still lists users', async () => {
    mockGetImplementation({ role: 'executive' });
    renderPage();
    await screen.findByText('Marco Ramírez');
    expect(screen.queryByLabelText('Nombre del usuario')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear usuario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restablecer contraseña/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Eliminar usuario/)).not.toBeInTheDocument();
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

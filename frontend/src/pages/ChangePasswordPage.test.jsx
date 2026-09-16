import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ChangePasswordPage } from './ChangePasswordPage.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { authApi } from '../api/auth.js';

vi.mock('../api/auth.js', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }
}));

function renderPage() {
  authApi.me.mockResolvedValue({
    user: { id: 1, email: 'a@vaovao.co', name: 'A', mustChangePassword: true },
    csrfToken: 'tok'
  });
  return render(
    <MemoryRouter initialEntries={['/cambiar-contrasena']}>
      <AuthProvider>
        <Routes>
          <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<div>Dashboard fantasma</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('ChangePasswordPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('submits current and new password, then redirects to dashboard', async () => {
    authApi.changePassword.mockResolvedValue({ ok: true });
    renderPage();
    await screen.findByLabelText('Contraseña actual (temporal)');
    await userEvent.type(screen.getByLabelText('Contraseña actual (temporal)'), 'Temp1234!');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'NuevaSecreta1!');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'NuevaSecreta1!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(authApi.changePassword).toHaveBeenCalledWith('Temp1234!', 'NuevaSecreta1!');
    expect(await screen.findByText('Dashboard fantasma')).toBeInTheDocument();
  });

  it('shows an error and does not submit when the new passwords do not match', async () => {
    renderPage();
    await screen.findByLabelText('Contraseña actual (temporal)');
    await userEvent.type(screen.getByLabelText('Contraseña actual (temporal)'), 'Temp1234!');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'NuevaSecreta1!');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Distinta1!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Las contraseñas nuevas no coinciden.')).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('shows an error and does not submit when the new password is shorter than 8 characters', async () => {
    renderPage();
    await screen.findByLabelText('Contraseña actual (temporal)');
    await userEvent.type(screen.getByLabelText('Contraseña actual (temporal)'), 'Temp1234!');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'short1');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'short1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('La nueva contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('shows the backend error message when the current password is wrong', async () => {
    authApi.changePassword.mockRejectedValue(Object.assign(new Error('Contraseña actual incorrecta.'), { status: 401 }));
    renderPage();
    await screen.findByLabelText('Contraseña actual (temporal)');
    await userEvent.type(screen.getByLabelText('Contraseña actual (temporal)'), 'wrong');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'NuevaSecreta1!');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'NuevaSecreta1!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Contraseña actual incorrecta.')).toBeInTheDocument();
  });
});

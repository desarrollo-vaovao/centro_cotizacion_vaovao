import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { authApi } from '../api/auth.js';

vi.mock('../api/auth.js', () => ({
  authApi: { me: vi.fn().mockRejectedValue(new Error('No autenticado.')), login: vi.fn(), logout: vi.fn() }
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => { vi.clearAllMocks(); authApi.me.mockRejectedValue(new Error('No autenticado.')); });

  it('submits email and password to authApi.login', async () => {
    authApi.login.mockResolvedValue({ user: { id: 1, email: 'a@vaovao.co', name: 'A' }, csrfToken: 'tok' });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Correo'), 'a@vaovao.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secret123!');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(authApi.login).toHaveBeenCalledWith('a@vaovao.co', 'Secret123!');
  });

  it('shows the backend error message on failed login', async () => {
    authApi.login.mockRejectedValue(Object.assign(new Error('Correo o contraseña incorrectos.'), { status: 401 }));
    renderLogin();
    await userEvent.type(screen.getByLabelText('Correo'), 'a@vaovao.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
  });
});

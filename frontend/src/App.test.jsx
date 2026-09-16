import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App.jsx';
import { authApi } from './api/auth.js';

vi.mock('./api/auth.js', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }
}));

describe('App', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('redirects an anonymous visitor to the login page', async () => {
    authApi.me.mockRejectedValue(new Error('No autenticado.'));
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('redirects a user who must change their password to /cambiar-contrasena', async () => {
    authApi.me.mockResolvedValue({
      user: { id: 1, email: 'a@vaovao.co', name: 'A', mustChangePassword: true },
      csrfToken: 'tok'
    });
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByText('Cambia tu contraseña')).toBeInTheDocument();
  });
});

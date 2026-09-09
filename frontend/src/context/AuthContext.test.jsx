import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { authApi } from '../api/auth.js';

vi.mock('../api/auth.js', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() }
}));

function Probe() {
  const { status, user } = useAuth();
  return <div>status:{status} user:{user ? user.email : 'none'}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('starts loading, then becomes authenticated when /auth/me succeeds', async () => {
    authApi.me.mockResolvedValue({ user: { id: 1, email: 'a@vaovao.co' }, csrfToken: 'tok' });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText(/status:loading/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/status:authenticated/)).toBeInTheDocument());
    expect(screen.getByText(/user:a@vaovao.co/)).toBeInTheDocument();
  });

  it('becomes anonymous when /auth/me rejects', async () => {
    authApi.me.mockRejectedValue(new Error('No autenticado.'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText(/status:anonymous/)).toBeInTheDocument());
  });

  it('clears local state even when /auth/logout rejects', async () => {
    authApi.me.mockResolvedValue({ user: { id: 1, email: 'a@vaovao.co' }, csrfToken: 'tok' });
    authApi.logout.mockRejectedValue(new Error('Network error'));

    function TestComponent() {
      const { status, user, logout } = useAuth();
      return (
        <div>
          <div>status:{status} user:{user ? user.email : 'none'}</div>
          <button onClick={async () => {
            try {
              await logout();
            } catch (err) {
              // silently catch — the state should still be cleared in the provider
            }
          }}>Logout</button>
        </div>
      );
    }

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.getByText(/status:authenticated/)).toBeInTheDocument());

    const logoutBtn = screen.getByRole('button', { name: 'Logout' });
    logoutBtn.click();

    await waitFor(() => expect(screen.getByText(/status:anonymous/)).toBeInTheDocument());
  });
});

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
});

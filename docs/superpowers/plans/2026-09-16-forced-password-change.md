# Forced Password Change on First Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person given a manually-issued temporary password be forced to set their own password the first time they log in, before they can use any other part of the app.

**Architecture:** A `must_change_password` boolean on `users`, surfaced on the two responses that already carry the logged-in user (`POST /auth/login`, `GET /auth/me`), a new `POST /auth/change-password` endpoint that verifies the current password before accepting a new one, and a frontend redirect gate in `ProtectedRoute` that sends a flagged user to a dedicated `/cambiar-contrasena` page instead of the rest of the app.

**Tech Stack:** Express + `pg` + `bcrypt` (backend), React + React Router + TanStack Query context (frontend), Vitest + Supertest (backend tests), Vitest + Testing Library (frontend tests) — all already in use, no new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-16-forced-password-change-design.md` — re-read it if anything below is unclear.
- Data stays shared across all users; this plan does not add per-user data scoping, roles, or an in-app account-management screen.
- Account creation stays manual (a one-off script run later, outside this plan) — not part of these tasks.
- No automated invitation email — out of scope for this plan.
- API responses use camelCase; the database uses snake_case. Every response object must be built explicitly field-by-field (never spread a raw DB row into a JSON response) so `must_change_password` becomes `mustChangePassword`.
- Mutating routes require both an authenticated session (`requireAuth`) and a valid CSRF token (`verifyCsrf`), applied in that order — this is the existing convention in `backend/src/app.js` and `backend/src/routes/auth.js`.
- Error responses are generic, user-facing Spanish strings (e.g. `'Contraseña actual incorrecta.'`) — matches the existing convention in `backend/src/routes/auth.js`.
- New password minimum length: 8 characters, enforced server-side (the source of truth) and mirrored client-side for immediate feedback.
- Changing the password does not rotate or destroy the session — the user stays logged in.

---

### Task 1: Migration runner supports multiple files; add `must_change_password` column

**Files:**
- Modify: `backend/src/migrations/run.js`
- Create: `backend/src/migrations/002_must_change_password.sql`
- Test: `backend/tests/migration.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `users.must_change_password` boolean column (`NOT NULL DEFAULT false`), and a migration runner that executes every `*.sql` file in `backend/src/migrations/` in filename-sorted order (so `003_...`, `004_...`, etc. work automatically in the future).

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/migration.test.js` (inside the existing `describe('migrations', ...)` block, as a new `it` alongside the existing ones):

```js
  it('adds must_change_password to users, defaulting to boolean', async () => {
    const { rows } = await pool.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'must_change_password'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('boolean');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- migration.test.js` (from `backend/`)
Expected: FAIL — `rows` has length 0 (column doesn't exist yet).

- [ ] **Step 3: Update the migration runner to run every `.sql` file in order**

Replace the full contents of `backend/src/migrations/run.js` with:

```js
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const files = readdirSync(__dirname).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(path.join(__dirname, file), 'utf8');
    await pool.query(sql);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(async () => { console.log('Migraciones aplicadas.'); await pool.end(); })
    .catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Create the new migration file**

Create `backend/src/migrations/002_must_change_password.sql`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
```

(`IF NOT EXISTS` keeps this idempotent — safe to run on every deploy, matching how `001_init.sql` uses `CREATE TABLE IF NOT EXISTS`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- migration.test.js` (from `backend/`)
Expected: PASS — all tests in `migration.test.js` pass, including the pre-existing ones (confirms multi-file execution didn't break `001_init.sql`).

- [ ] **Step 6: Run the full backend test suite**

Run: `npm test` (from `backend/`)
Expected: PASS — no other test regresses (the new column has a default, so `seedTestUser` and every other insert into `users` keep working unchanged).

- [ ] **Step 7: Commit**

```bash
git add backend/src/migrations/run.js backend/src/migrations/002_must_change_password.sql backend/tests/migration.test.js
git commit -m "feat: support multi-file migrations, add must_change_password column"
```

---

### Task 2: Expose `mustChangePassword` on login and `/auth/me`

**Files:**
- Modify: `backend/src/routes/auth.js`
- Test: `backend/tests/auth.test.js`

**Interfaces:**
- Consumes: `users.must_change_password` column (Task 1).
- Produces: `POST /auth/login` and `GET /auth/me` both return `{ user: { id, email, name, mustChangePassword }, csrfToken }`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/auth.test.js`. First, add the `pool` import at the top of the file:

```js
import { pool } from '../src/db.js';
```

Then add these two tests inside the existing `describe('auth', ...)` block:

```js
  it('reports mustChangePassword=false for a normal account on login', async () => {
    const agent = makeAgent();
    const res = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(res.body.user.mustChangePassword).toBe(false);
  });

  it('reports mustChangePassword=true on login and /auth/me for a flagged account', async () => {
    await pool.query(`UPDATE users SET must_change_password = true WHERE email = 'test@vaovao.co'`);
    const agent = makeAgent();
    const loginRes = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(loginRes.body.user.mustChangePassword).toBe(true);

    const meRes = await agent.get('/auth/me');
    expect(meRes.body.user.mustChangePassword).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- auth.test.js` (from `backend/`)
Expected: FAIL — `mustChangePassword` is `undefined`, not `false`/`true`.

- [ ] **Step 3: Update the login handler**

In `backend/src/routes/auth.js`, replace the login handler's query and response with:

```js
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name, must_change_password FROM users WHERE email = $1',
      [String(email).toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    req.session.regenerate((regenErr) => {
      if (regenErr) return next(regenErr);
      req.session.userId = user.id;
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.json({
          user: { id: user.id, email: user.email, name: user.name, mustChangePassword: user.must_change_password },
          csrfToken: req.session.csrfToken
        });
      });
    });
```

- [ ] **Step 4: Update the `/me` handler**

Replace the `/me` handler's query and response with:

```js
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    const { rows } = await pool.query(
      'SELECT id, email, name, must_change_password FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'No autenticado.' });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, mustChangePassword: user.must_change_password },
      csrfToken: req.session.csrfToken
    });
  } catch (err) { next(err); }
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- auth.test.js` (from `backend/`)
Expected: PASS — all tests in `auth.test.js`, including the two new ones and the pre-existing ones.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/auth.js backend/tests/auth.test.js
git commit -m "feat: expose mustChangePassword on login and /auth/me"
```

---

### Task 3: `POST /auth/change-password` endpoint

**Files:**
- Modify: `backend/src/routes/auth.js`
- Test: `backend/tests/auth.test.js`

**Interfaces:**
- Consumes: `verifyPassword`/`hashPassword` from `backend/src/utils/password.js`, `requireAuth` from `backend/src/middleware/auth.js`, `verifyCsrf` from `backend/src/middleware/csrf.js` (all already exist and are already imported/used elsewhere in the app).
- Produces: `POST /auth/change-password` — requires an authenticated session and CSRF token; body `{ currentPassword, newPassword }`; on success returns `{ ok: true }` and clears `must_change_password`; on wrong current password returns 401; on a new password under 8 characters returns 400; on no session returns 401; on missing/invalid CSRF token returns 403.

- [ ] **Step 1: Write the failing tests**

Update the helpers import at the top of `backend/tests/auth.test.js` to also bring in `loginAgent`:

```js
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';
```

Then add, as a new `describe` block after the existing `describe('auth', ...)` block closes:

```js
describe('POST /auth/change-password', () => {
  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
  });

  it('changes the password, clears must_change_password, and the old password stops working', async () => {
    await pool.query(`UPDATE users SET must_change_password = true WHERE email = 'test@vaovao.co'`);
    const agent = makeAgent();
    const csrfToken = await loginAgent(agent);

    const res = await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'Test1234!', newPassword: 'NewSecret456!' });
    expect(res.status).toBe(200);

    const meRes = await agent.get('/auth/me');
    expect(meRes.body.user.mustChangePassword).toBe(false);

    const oldLogin = await makeAgent().post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await makeAgent().post('/auth/login').send({ email: 'test@vaovao.co', password: 'NewSecret456!' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an incorrect current password', async () => {
    const agent = makeAgent();
    const csrfToken = await loginAgent(agent);
    const res = await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'wrong', newPassword: 'NewSecret456!' });
    expect(res.status).toBe(401);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const agent = makeAgent();
    const csrfToken = await loginAgent(agent);
    const res = await agent.post('/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'Test1234!', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('requires an authenticated session', async () => {
    const res = await makeAgent().post('/auth/change-password').send({ currentPassword: 'x', newPassword: 'NewSecret456!' });
    expect(res.status).toBe(401);
  });

  it('requires a valid CSRF token', async () => {
    const agent = makeAgent();
    await loginAgent(agent);
    const res = await agent.post('/auth/change-password').send({ currentPassword: 'Test1234!', newPassword: 'NewSecret456!' });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- auth.test.js` (from `backend/`)
Expected: FAIL with 404s — the route doesn't exist yet.

- [ ] **Step 3: Add the endpoint**

In `backend/src/routes/auth.js`, update the imports at the top of the file:

```js
import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { createLoginLimiter } from '../middleware/rateLimit.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { requireAuth } from '../middleware/auth.js';
```

Then add this route, after the `/me` handler and before `export default router;`:

```js
router.post('/change-password', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    const user = rows[0];
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
    }
    const newHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [newHash, req.session.userId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- auth.test.js` (from `backend/`)
Expected: PASS — all tests in `auth.test.js`.

- [ ] **Step 5: Run the full backend test suite**

Run: `npm test` (from `backend/`)
Expected: PASS — no regressions elsewhere.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/auth.js backend/tests/auth.test.js
git commit -m "feat: add POST /auth/change-password endpoint"
```

---

### Task 4: Frontend — `authApi.changePassword` and `AuthContext.completePasswordChange`

**Files:**
- Modify: `frontend/src/api/auth.js`
- Modify: `frontend/src/context/AuthContext.jsx`
- Test: `frontend/src/context/AuthContext.test.jsx`

**Interfaces:**
- Consumes: `POST /auth/change-password` (Task 3) via the existing `api` client in `frontend/src/lib/apiClient.js`.
- Produces: `authApi.changePassword(currentPassword, newPassword)` → `Promise<{ ok: true }>`; `useAuth()` now also returns `completePasswordChange()`, a function that flips the in-memory `user.mustChangePassword` to `false` without needing to re-fetch `/auth/me`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/context/AuthContext.test.jsx`, as a new `it` inside the `describe('AuthProvider', ...)` block:

```js
  it('completePasswordChange flips mustChangePassword to false without a re-fetch', async () => {
    authApi.me.mockResolvedValue({
      user: { id: 1, email: 'a@vaovao.co', mustChangePassword: true },
      csrfToken: 'tok'
    });

    function ProbeWithFlag() {
      const { status, user, completePasswordChange } = useAuth();
      return (
        <div>
          <div>status:{status} mustChange:{user ? String(user.mustChangePassword) : 'none'}</div>
          <button onClick={completePasswordChange}>Done</button>
        </div>
      );
    }

    render(<AuthProvider><ProbeWithFlag /></AuthProvider>);
    await waitFor(() => expect(screen.getByText(/mustChange:true/)).toBeInTheDocument());

    screen.getByRole('button', { name: 'Done' }).click();

    await waitFor(() => expect(screen.getByText(/mustChange:false/)).toBeInTheDocument());
    expect(authApi.me).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/context/AuthContext.test.jsx` (from `frontend/`)
Expected: FAIL — `completePasswordChange` is `undefined`, calling it throws.

- [ ] **Step 3: Add `changePassword` to the API client**

Replace the full contents of `frontend/src/api/auth.js` with:

```js
import { api } from '../lib/apiClient.js';

export const authApi = {
  me: () => api.get('/auth/me'),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword })
};
```

- [ ] **Step 4: Add `completePasswordChange` to `AuthContext`**

In `frontend/src/context/AuthContext.jsx`, add this callback after the `logout` callback (before the `return` statement):

```js
  const completePasswordChange = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }, []);
```

Then add `completePasswordChange` to the context value:

```js
  return (
    <AuthContext.Provider value={{ user, status, login, logout, completePasswordChange }}>
      {children}
    </AuthContext.Provider>
  );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/context/AuthContext.test.jsx` (from `frontend/`)
Expected: PASS — all tests in `AuthContext.test.jsx`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/auth.js frontend/src/context/AuthContext.jsx frontend/src/context/AuthContext.test.jsx
git commit -m "feat: add changePassword API call and completePasswordChange to AuthContext"
```

---

### Task 5: `ChangePasswordPage`, `ProtectedRoute` redirect gate, and routing

**Files:**
- Create: `frontend/src/pages/ChangePasswordPage.jsx`
- Create: `frontend/src/pages/ChangePasswordPage.test.jsx`
- Modify: `frontend/src/components/layout/ProtectedRoute.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/App.test.jsx`

**Interfaces:**
- Consumes: `authApi.changePassword` and `useAuth().completePasswordChange` (Task 4); `useAuth().user.mustChangePassword` (Task 2, surfaced through `AuthContext`'s existing `/auth/me` call).
- Produces: route `/cambiar-contrasena`; any authenticated request to any other route redirects there first when `user.mustChangePassword` is true.

- [ ] **Step 1: Write the failing tests for `ChangePasswordPage`**

Create `frontend/src/pages/ChangePasswordPage.test.jsx`:

```jsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/ChangePasswordPage.test.jsx` (from `frontend/`)
Expected: FAIL — the module `./ChangePasswordPage.jsx` doesn't exist yet.

- [ ] **Step 3: Create `ChangePasswordPage.jsx`**

Create `frontend/src/pages/ChangePasswordPage.jsx`:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../api/auth.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card } from '../components/ui/card.jsx';

export function ChangePasswordPage() {
  const { completePasswordChange, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      completePasswordChange();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f6f4fc] to-muted">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-medium">Cambia tu contraseña</h1>
        <p className="mb-4 text-xs text-text-secondary">
          Tu cuenta tiene una contraseña temporal. Elige una nueva para continuar.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-xs font-medium text-text-secondary">
              Contraseña actual (temporal)
            </label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-text-secondary">
              Nueva contraseña
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-text-secondary">
              Confirmar nueva contraseña
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
          <Button type="button" onClick={logout}>Cerrar sesión</Button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/ChangePasswordPage.test.jsx` (from `frontend/`)
Expected: PASS — all three tests.

- [ ] **Step 5: Write the failing integration test for the redirect gate**

Add to `frontend/src/App.test.jsx`. First, update the mock factory at the top of the file to include `changePassword`:

```js
vi.mock('./api/auth.js', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }
}));
```

Then add this test inside the `describe('App', ...)` block:

```js
  it('redirects a user who must change their password to /cambiar-contrasena', async () => {
    authApi.me.mockResolvedValue({
      user: { id: 1, email: 'a@vaovao.co', name: 'A', mustChangePassword: true },
      csrfToken: 'tok'
    });
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByText('Cambia tu contraseña')).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/App.test.jsx` (from `frontend/`)
Expected: FAIL — still lands on the dashboard (no redirect exists yet) or errors because the route doesn't exist.

- [ ] **Step 7: Update `ProtectedRoute` to redirect when `mustChangePassword` is true**

Replace the full contents of `frontend/src/components/layout/ProtectedRoute.jsx` with:

```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="p-8 text-text-secondary">Cargando…</div>;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (user?.mustChangePassword && location.pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" replace />;
  }
  return children;
}
```

- [ ] **Step 8: Wire the route into `App.jsx`**

In `frontend/src/App.jsx`, add the import:

```js
import { ChangePasswordPage } from './pages/ChangePasswordPage.jsx';
```

Then add a new top-level route, as a sibling of `/login` and `/` (before the `/` route):

```jsx
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/cambiar-contrasena"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
```

(This replaces just the `<Route path="/login" ... />` line and inserts the new route right after it, immediately before the existing `<Route path="/" ...>`.)

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/App.test.jsx` (from `frontend/`)
Expected: PASS — both the pre-existing anonymous-redirect test and the new mustChangePassword-redirect test.

- [ ] **Step 10: Run the full frontend test suite and build**

Run: `npx vitest run` (from `frontend/`)
Expected: PASS — no regressions anywhere (in particular, `LoginPage.test.jsx` and `AuthContext.test.jsx` still pass since `mustChangePassword` is `undefined`/falsy for their mocked users, which correctly does not trigger a redirect).

Run: `npm run build` (from `frontend/`)
Expected: build succeeds with no errors.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/ChangePasswordPage.jsx frontend/src/pages/ChangePasswordPage.test.jsx frontend/src/components/layout/ProtectedRoute.jsx frontend/src/App.jsx frontend/src/App.test.jsx
git commit -m "feat: add forced password-change page and redirect gate"
```

---

## After all tasks: deploy

This branch (`worktree-backend-implementation`) has been pushed straight to `main` for every change this session, which auto-deploys both Railway (backend) and Vercel (frontend). Once all 5 tasks are committed:

1. Push to both `worktree-backend-implementation` and `main`.
2. Confirm the Railway deployment succeeds and the migration log shows `must_change_password` applied (check deploy logs for `Migraciones aplicadas.` with no errors).
3. Manually smoke-test: log in as the existing admin account and confirm nothing changed (no redirect, since `must_change_password` is `false` for that account) — the admin's real password was created before this column existed, so it must NOT be forced to change.

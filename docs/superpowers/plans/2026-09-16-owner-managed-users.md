# Owner-Managed Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the "Ejecutivos" catalog into the `users` login table, add an `owner`/`executive` role, and let the owner create accounts, reset passwords, and delete accounts from an in-app "Usuarios" panel — with system-generated passwords shown once, reusing the existing forced-password-change-on-first-login flow.

**Architecture:** One additive migration (`users.role`, drop `executives`, repoint `quotations.executive_id` to `users`); the existing `/executives` route and `useExecutives`/`api/executives.js` frontend surface stay in place but now read/write `users`; a new `requireOwner` middleware gates the three mutating routes; the Catalogo page's Ejecutivos panel becomes a Usuarios panel with owner-conditional controls; the quotation form's inline "+ Nuevo ejecutivo" quick-add is removed.

**Tech Stack:** Express + `pg` + `bcrypt` (backend), React + TanStack Query (frontend), Vitest + Supertest / Vitest + Testing Library (tests) — all already in use, no new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-16-owner-managed-users-design.md` — re-read it if anything below is unclear.
- No permission difference anywhere in the app besides account management (create/reset-password/delete) — everything else (quotations, clients, dashboard, catalog) stays visible/editable by every logged-in user regardless of role, exactly as today.
- Passwords are always system-generated server-side and returned exactly once in the create/reset-password response — never re-viewable, never logged.
- A user cannot delete their own account.
- API responses use camelCase; the database uses snake_case. Every response object is built explicitly field-by-field (never spread a raw DB row into a JSON response).
- Error responses are generic, user-facing Spanish strings, matching the existing convention in this codebase's route handlers.
- This repo's convention: commit messages and PRs must NOT contain any Claude/AI-attribution trailer.
- This backend's migration runner (`backend/src/migrations/run.js`) re-runs every `.sql` file on every boot with no ledger yet — every migration file must be hand-written idempotent (safe to execute more than once with no error and no duplicate effect).

---

### Task 1: Migration — `users.role`, drop `executives`, repoint the FK

**Files:**
- Create: `backend/src/migrations/003_users_role_and_executives_merge.sql`
- Modify: `backend/tests/migration.test.js`

**Interfaces:**
- Consumes: nothing new (the migration runner from the previous feature already runs every `.sql` file in sorted order).
- Produces: `users.role` (`TEXT NOT NULL DEFAULT 'executive'`); the `executives` table no longer exists; `quotations.executive_id`'s foreign key now references `users(id)` (constraint name `quotations_executive_id_fkey`, same name Postgres auto-generated for the original inline `REFERENCES executives(id)`, so later tasks/tests can assert on that exact name).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `backend/tests/migration.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import { pool } from '../src/db.js';

describe('migrations', () => {
  it('creates all expected tables and drops executives', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const names = rows.map((r) => r.table_name);
    for (const t of ['users', 'clients', 'service_lines', 'quotations', 'settings']) {
      expect(names).toContain(t);
    }
    expect(names).not.toContain('executives');
  });

  it('seeds the single settings row', async () => {
    const { rows } = await pool.query('SELECT general_seq FROM settings WHERE id = 1');
    expect(rows[0].general_seq).toBe(0);
  });

  it('adds must_change_password to users, defaulting to boolean', async () => {
    const { rows } = await pool.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'must_change_password'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('boolean');
  });

  it('adds role to users, defaulting to executive', async () => {
    const { rows } = await pool.query(
      `SELECT column_default FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'role'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].column_default).toContain('executive');
  });

  it('points quotations.executive_id at users, not executives', async () => {
    const { rows } = await pool.query(`
      SELECT ccu.table_name AS referenced_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'quotations'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'quotations_executive_id_fkey'
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].referenced_table).toBe('users');
  });

  it('re-running all migrations is safe (idempotent)', async () => {
    const { runMigrations } = await import('../src/migrations/run.js');
    await expect(runMigrations()).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- migration.test.js` (from `backend/`)
Expected: FAIL — `role` column and the new FK target don't exist yet; the "drops executives" assertion fails because `executives` is still present.

- [ ] **Step 3: Create the migration file**

Create `backend/src/migrations/003_users_role_and_executives_merge.sql`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'executive';

DROP TABLE IF EXISTS executives CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_executive_id_fkey'
  ) THEN
    ALTER TABLE quotations
      ADD CONSTRAINT quotations_executive_id_fkey FOREIGN KEY (executive_id) REFERENCES users(id);
  END IF;
END $$;
```

Notes for the implementer (do not skip reading this): `DROP TABLE IF EXISTS executives CASCADE` also drops the old auto-named FK constraint that referenced `executives` (Postgres cascades constraint drops when the referenced table is dropped) — so by the time the `DO` block runs, no constraint named `quotations_executive_id_fkey` exists yet on a first run, and the `IF NOT EXISTS` guard is what makes re-running this file safe: on a second run, `DROP TABLE IF EXISTS` is a no-op (table's already gone) and the `DO` block sees the constraint from the first run and skips re-adding it (re-adding an already-existing constraint with the same name would error).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- migration.test.js` (from `backend/`)
Expected: PASS — all 6 tests.

- [ ] **Step 5: Run the full backend test suite**

Run: `npm test` (from `backend/`)
Expected: Several OTHER test files will now fail — `backend/tests/executives.test.js`, `backend/tests/clients.test.js`, `backend/tests/dashboard.test.js`, `backend/tests/quotationsCreate.test.js`, `backend/tests/quotationsUpdate.test.js` — because they still `POST /executives` with only `{ name }` against the (now-repointed) route, or assert on the old `executives` table shape. **This is expected and will be fixed in Task 3.** Confirm the failures are limited to those files and that `migration.test.js`, `auth.test.js`, and everything else unrelated to executives still passes.

- [ ] **Step 6: Commit**

```bash
git add backend/src/migrations/003_users_role_and_executives_merge.sql backend/tests/migration.test.js
git commit -m "feat: add users.role, drop executives, repoint quotations FK to users"
```

---

### Task 2: `role` on session/login/me, and a `requireOwner` middleware

**Files:**
- Modify: `backend/src/routes/auth.js`
- Modify: `backend/src/middleware/auth.js`
- Modify: `backend/tests/helpers/index.js`
- Modify: `backend/tests/auth.test.js`

**Interfaces:**
- Consumes: `users.role` (Task 1).
- Produces: `POST /auth/login` and `GET /auth/me` responses include `role` on the user object (alongside `id`, `email`, `name`, `mustChangePassword`). `req.session.role` is set at login. A new `requireOwner` middleware (exported from `backend/src/middleware/auth.js` alongside the existing `requireAuth`) responds 403 with `{ error: 'Solo el owner puede realizar esta acción.' }` unless `req.session.role === 'owner'`. Test helper `seedTestUser()` now creates its account with `role = 'owner'` (so every other test file that already logs in via this helper keeps working against owner-gated routes without changes); a new helper `seedTestExecutive()` creates a second account with `role = 'executive'` for tests that need to exercise the non-owner path.

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/auth.test.js`, inside the existing `describe('auth', ...)` block, two new tests (alongside the existing `mustChangePassword` tests from the previous feature):

```js
  it('reports role=owner on login and /auth/me for the seeded test account', async () => {
    const agent = makeAgent();
    const loginRes = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
    expect(loginRes.body.user.role).toBe('owner');
    const meRes = await agent.get('/auth/me');
    expect(meRes.body.user.role).toBe('owner');
  });

  it('reports role=executive for a non-owner account', async () => {
    await seedTestExecutive();
    const agent = makeAgent();
    const res = await agent.post('/auth/login').send({ email: 'exec@vaovao.co', password: 'Test1234!' });
    expect(res.body.user.role).toBe('executive');
  });
```

Update the top-of-file import to bring in the new helper:

```js
import { makeAgent, resetDb, seedTestUser, seedTestExecutive, loginAgent } from './helpers/index.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- auth.test.js` (from `backend/`)
Expected: FAIL — `seedTestExecutive` doesn't exist yet (import error), and `role` is `undefined` on the response.

- [ ] **Step 3: Add `seedTestExecutive` and make `seedTestUser` an owner**

In `backend/tests/helpers/index.js`, replace the `seedTestUser` function and add a new one right after it:

```js
export async function seedTestUser() {
  const passwordHash = await hashPassword('Test1234!');
  await pool.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ('test@vaovao.co', $1, 'Test User', 'owner')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = false, role = 'owner'`,
    [passwordHash]
  );
}

export async function seedTestExecutive() {
  const passwordHash = await hashPassword('Test1234!');
  await pool.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ('exec@vaovao.co', $1, 'Test Executive', 'executive')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = false, role = 'executive'`,
    [passwordHash]
  );
}
```

(The `must_change_password = false` in `seedTestUser`'s `ON CONFLICT` clause already existed before this task — keep it. `seedTestExecutive` needs the same reset for the same reason: a stale `true` from an earlier test could otherwise leak across tests that reuse `exec@vaovao.co`.)

- [ ] **Step 4: Add `requireOwner` middleware**

Replace the full contents of `backend/src/middleware/auth.js` with:

```js
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  next();
}

export function requireOwner(req, res, next) {
  if (!req.session || req.session.role !== 'owner') {
    return res.status(403).json({ error: 'Solo el owner puede realizar esta acción.' });
  }
  next();
}
```

- [ ] **Step 5: Set `req.session.role` at login and expose `role` on both responses**

In `backend/src/routes/auth.js`, update the login handler's query and response (the `SELECT` and the `req.session.save` callback's `res.json`):

```js
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name, must_change_password, role FROM users WHERE email = $1',
      [String(email).toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    req.session.regenerate((regenErr) => {
      if (regenErr) return next(regenErr);
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.json({
          user: { id: user.id, email: user.email, name: user.name, mustChangePassword: user.must_change_password, role: user.role },
          csrfToken: req.session.csrfToken
        });
      });
    });
```

And update the `/me` handler's query and response:

```js
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    const { rows } = await pool.query(
      'SELECT id, email, name, must_change_password, role FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'No autenticado.' });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, mustChangePassword: user.must_change_password, role: user.role },
      csrfToken: req.session.csrfToken
    });
  } catch (err) { next(err); }
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- auth.test.js` (from `backend/`)
Expected: PASS — all tests in `auth.test.js`.

- [ ] **Step 7: Run the full backend test suite**

Run: `npm test` (from `backend/`)
Expected: the same set of executives/clients/dashboard/quotations failures from Task 1 persist (still expected, fixed in Task 3) — but no NEW failures should appear. `auth.test.js` and everything not touching `/executives` fixture creation should be green.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/auth.js backend/src/middleware/auth.js backend/tests/helpers/index.js backend/tests/auth.test.js
git commit -m "feat: add role to session/login/me and a requireOwner middleware"
```

---

### Task 3: Rewrite the `/executives` route to operate on `users`, owner-gated

**Files:**
- Modify: `backend/src/utils/password.js`
- Modify: `backend/src/routes/executives.js`
- Modify: `backend/src/routes/dashboard.js`
- Modify: `backend/src/seed.js`
- Modify: `backend/tests/executives.test.js`
- Modify: `backend/tests/password.test.js`
- Modify: `backend/tests/clients.test.js`
- Modify: `backend/tests/dashboard.test.js`
- Modify: `backend/tests/quotationsCreate.test.js`
- Modify: `backend/tests/quotationsUpdate.test.js`

This is the largest task in the plan — it's one task because every file in it is a direct, mechanical consequence of one change (the `/executives` route now creates real login accounts instead of name-only rows), and a reviewer needs to see them together to confirm nothing was missed.

**Interfaces:**
- Consumes: `requireOwner` (Task 2), `users.role` (Task 1).
- Produces: `generateTempPassword()` exported from `backend/src/utils/password.js` — returns a 12-character random string drawn from an unambiguous alphabet (no `0/O/1/l/I`). `GET /executives` returns `[{ id, name, email, role }]` for every user, open to any authenticated request (unchanged access level from before). `POST /executives` (owner-only) takes `{ name, email }`, returns `{ id, name, email, role, tempPassword }` (201). `POST /executives/:id/reset-password` (owner-only, no body) returns `{ tempPassword }` (200). `DELETE /executives/:id` (owner-only) returns 204, 400 if deleting your own account, 404 if the id doesn't exist, 409 if the user has quotations attributed to them.

- [ ] **Step 1: Write the failing test for `generateTempPassword`**

Add to `backend/tests/password.test.js`, inside the existing `describe('password hashing', ...)` block — rename the `describe` to cover both, since this file now tests two related utilities:

```js
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateTempPassword } from '../src/utils/password.js';

describe('password utils', () => {
  it('hashes a password and verifies the correct plain text against it', async () => {
    const hash = await hashPassword('Test1234!');
    expect(hash).not.toBe('Test1234!');
    expect(await verifyPassword('Test1234!', hash)).toBe(true);
  });

  it('rejects an incorrect plain text password', async () => {
    const hash = await hashPassword('Test1234!');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('generates a 12-character temporary password with no ambiguous characters', () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(12);
    expect(pw).not.toMatch(/[0O1lI]/);
  });

  it('generates a different password on each call', () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword());
  });
});
```

This replaces the full contents of `backend/tests/password.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- password.test.js` (from `backend/`)
Expected: FAIL — `generateTempPassword` is not exported yet.

- [ ] **Step 3: Add `generateTempPassword`**

Replace the full contents of `backend/src/utils/password.js` with:

```js
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

const ROUNDS = 12;
// Excludes visually ambiguous characters (0/O, 1/l/I) since temp passwords
// get hand-copied and shared over chat — a small kindness to whoever has to
// type this in.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMP_PASSWORD_LENGTH = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function generateTempPassword() {
  let out = '';
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    out += TEMP_PASSWORD_ALPHABET[crypto.randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- password.test.js` (from `backend/`)
Expected: PASS — all 4 tests.

- [ ] **Step 5: Write the failing tests for the rewritten `/executives` route**

Replace the full contents of `backend/tests/executives.test.js` with:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, seedTestExecutive, loginAgent } from './helpers/index.js';

describe('executives (users with role)', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
  });

  it('rejects a new user without a name', async () => {
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ email: 'a@vaovao.co' });
    expect(res.status).toBe(400);
  });

  it('rejects a new user without an email', async () => {
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez' });
    expect(res.status).toBe(400);
  });

  it('creates a user with role=executive, must_change_password=true, and returns a one-time tempPassword', async () => {
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken)
      .send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('executive');
    expect(res.body.tempPassword).toHaveLength(12);

    // the returned tempPassword actually logs the new account in, and it is
    // flagged to force a password change on that first login
    const newLogin = await makeAgent().post('/auth/login').send({ email: 'mishel@vaovao.co', password: res.body.tempPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });

  it('rejects creating a user with an email already in use', async () => {
    await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' });
    const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Otro Nombre', email: 'mishel@vaovao.co' });
    expect(res.status).toBe(409);
  });

  it('lists users ordered by name, including email and role', async () => {
    await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' });
    const res = await agent.get('/executives');
    const mishel = res.body.find((u) => u.email === 'mishel@vaovao.co');
    expect(mishel.role).toBe('executive');
    expect(mishel.name).toBe('Mishel Velez');
  });

  it('a non-owner cannot create a user', async () => {
    await seedTestExecutive();
    const execAgent = makeAgent();
    const execCsrf = await loginAgent2(execAgent);
    const res = await execAgent.post('/executives').set('X-CSRF-Token', execCsrf).send({ name: 'X', email: 'x@vaovao.co' });
    expect(res.status).toBe(403);
  });

  it('resets a user\'s password and returns a new one-time tempPassword', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    const res = await agent.post(`/executives/${created.id}/reset-password`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toHaveLength(12);
    expect(res.body.tempPassword).not.toBe(created.tempPassword);

    const newLogin = await makeAgent().post('/auth/login').send({ email: 'mishel@vaovao.co', password: res.body.tempPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });

  it('a non-owner cannot reset another user\'s password', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    await seedTestExecutive();
    const execAgent = makeAgent();
    const execCsrf = await loginAgent2(execAgent);
    const res = await execAgent.post(`/executives/${created.id}/reset-password`).set('X-CSRF-Token', execCsrf);
    expect(res.status).toBe(403);
  });

  it('deletes a user', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    const res = await agent.delete(`/executives/${created.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(204);
    const list = await agent.get('/executives');
    expect(list.body.map((u) => u.id)).not.toContain(created.id);
  });

  it('returns 404 when deleting a user that does not exist', async () => {
    const res = await agent.delete('/executives/999999').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(404);
  });

  it('refuses to let a user delete their own account', async () => {
    const me = await agent.get('/auth/me');
    const res = await agent.delete(`/executives/${me.body.user.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(400);
  });

  it('a non-owner cannot delete a user', async () => {
    const created = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    await seedTestExecutive();
    const execAgent = makeAgent();
    const execCsrf = await loginAgent2(execAgent);
    const res = await execAgent.delete(`/executives/${created.id}`).set('X-CSRF-Token', execCsrf);
    expect(res.status).toBe(403);
  });

  it('refuses to delete a user that has quotations', async () => {
    const client = await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'Tengo Tienda', country: 'Guatemala' });
    const exec = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Mishel Velez', email: 'mishel@vaovao.co' })).body;
    await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send({
      clientId: client.body.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id,
      proyecto: 'Contenidos', detalle: ['Edición de 6 videos'], monto: 100
    });
    const res = await agent.delete(`/executives/${exec.id}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(409);
  });
});

// exec@vaovao.co's password is the same fixed test password seedTestUser
// uses — this local helper avoids re-exporting a second loginAgent variant
// from helpers/index.js just for one different email.
async function loginAgent2(agent) {
  const res = await agent.post('/auth/login').send({ email: 'exec@vaovao.co', password: 'Test1234!' });
  return res.body.csrfToken;
}
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm test -- executives.test.js` (from `backend/`)
Expected: FAIL — the route still only accepts `{ name }`, has no owner gating, and there's no `/reset-password` sub-route.

- [ ] **Step 7: Rewrite the executives route**

Replace the full contents of `backend/src/routes/executives.js` with:

```js
import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, generateTempPassword } from '../utils/password.js';
import { requireOwner } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role FROM users ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', requireOwner, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'El correo es requerido.' });
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, 'executive', true)
       RETURNING id, name, email, role`,
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );
    res.status(201).json({ ...rows[0], tempPassword });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese correo ya está en uso.' });
    next(err);
  }
});

router.post('/:id/reset-password', requireOwner, async (req, res, next) => {
  try {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const { rowCount } = await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2',
      [passwordHash, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({ tempPassword });
  } catch (err) { next(err); }
});

router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.session.userId)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
    }
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'No se puede eliminar: el usuario tiene cotizaciones asociadas.' });
    next(err);
  }
});

export default router;
```

- [ ] **Step 8: Fix the dashboard executive-name lookup**

In `backend/src/routes/dashboard.js`, change:

```js
      pool.query('SELECT id, name FROM executives')
```

to:

```js
      pool.query('SELECT id, name FROM users')
```

(This is the only reference to the `executives` table left in `dashboard.js` — it feeds `execNames` used for the ranking-by-executive dashboard section, and every user, regardless of role, is a valid quotation-attribution target.)

- [ ] **Step 9: Make the seed script provision the owner role**

In `backend/src/seed.js`, update the insert to set `role = 'owner'`:

```js
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'owner')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = 'owner'`,
      [email.toLowerCase().trim(), passwordHash, name]
    );
```

- [ ] **Step 10: Fix the fixture data in the other test files that create an executive**

Each of these files creates an executive purely as setup for a quotation and currently sends only `{ name }`; add `email` to each (the owner-seeded `agent` in every one of these files is created via `seedTestUser()`, which Task 2 made an owner, so these calls remain authorized with no other changes needed):

In `backend/tests/clients.test.js`, line with `agent.post('/executives')...send({ name: 'Marco Ramírez' })` becomes:

```js
    const exec = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco Ramírez', email: 'marco@vaovao.co' });
```

In `backend/tests/dashboard.test.js`, line with `agent.post('/executives')...send({ name: 'Marco' })` becomes:

```js
    exec = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco', email: 'marco@vaovao.co' })).body;
```

In `backend/tests/quotationsCreate.test.js`, the `createExecutive` helper function becomes:

```js
async function createExecutive(agent, csrfToken) {
  const res = await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco Ramírez', email: 'marco@vaovao.co' });
  return res.body;
}
```

In `backend/tests/quotationsUpdate.test.js`, the line with `agent.post('/executives')...send({ name: 'Marco' })` becomes:

```js
  const exec = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco', email: 'marco@vaovao.co' })).body;
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm test -- executives.test.js` (from `backend/`)
Expected: PASS — all tests.

- [ ] **Step 12: Run the full backend test suite**

Run: `npm test` (from `backend/`)
Expected: PASS — every file, no failures anywhere (this closes out the failures Tasks 1 and 2 left as expected).

- [ ] **Step 13: Commit**

```bash
git add backend/src/utils/password.js backend/src/routes/executives.js backend/src/routes/dashboard.js backend/src/seed.js backend/tests/executives.test.js backend/tests/password.test.js backend/tests/clients.test.js backend/tests/dashboard.test.js backend/tests/quotationsCreate.test.js backend/tests/quotationsUpdate.test.js
git commit -m "feat: rewrite /executives to manage users with owner-gated create/reset/delete"
```

---

### Task 4: Frontend — Usuarios panel in Configuración

**Files:**
- Modify: `frontend/src/api/executives.js`
- Modify: `frontend/src/pages/CatalogoPage.jsx`
- Modify: `frontend/src/pages/CatalogoPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()` (existing, from `frontend/src/context/AuthContext.jsx` — `user.role` is already on the object as of the previous session's auth work, no context changes needed here); `GET/POST/DELETE /executives` and `POST /executives/:id/reset-password` (Task 3).
- Produces: `useResetExecutivePassword()` hook in `frontend/src/api/executives.js`. The Ejecutivos card in Configuración is renamed "Usuarios" and shows name + email + an "Owner" badge per row; when the logged-in user's `role` is `'owner'`, a "Crear usuario" form and per-row "Restablecer contraseña"/delete controls appear (delete hidden on your own row); creating or resetting shows the returned `tempPassword` once in a dismissible panel with a copy button.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/src/pages/CatalogoPage.test.jsx` with:

```jsx
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
```

Notes on two tests above the implementer should understand before running them:
- `'an owner can create a new user...'` queries `screen.findByText('mishel@vaovao.co', { selector: 'strong' })` — this assumes the revealed-password panel renders the email inside a `<strong>` tag, per Step 4 below. If you structure that panel differently, adjust the query to match, but keep the assertion specific enough to prove the panel actually rendered (not just that the email text exists somewhere, which the row list would already satisfy).
- The "Restablecer contraseña" button's accessible name in these tests is `Restablecer contraseña de Marco Ramírez` (per-row, distinguishing multiple rows) — implement it as the button's visible text plus an `aria-label`, or a plain `aria-label` alone; either satisfies `getByRole('button', { name: ... })`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/CatalogoPage.test.jsx` (from `frontend/`)
Expected: FAIL — the panel is still named "Ejecutivos", has no owner-conditional rendering, no reset-password button, and `useResetExecutivePassword` doesn't exist.

- [ ] **Step 3: Add `useResetExecutivePassword`**

In `frontend/src/api/executives.js`, add this export (the file's other exports — `useExecutives`, `useCreateExecutive`, `useDeleteExecutive` — stay exactly as they are):

```js
export function useResetExecutivePassword() {
  return useMutation({
    mutationFn: (id) => api.post(`/executives/${id}/reset-password`)
  });
}
```

- [ ] **Step 4: Rewrite the Ejecutivos panel as a Usuarios panel**

In `frontend/src/pages/CatalogoPage.jsx`:

Add these two imports at the top of the file:

```js
import { useExecutives, useCreateExecutive, useDeleteExecutive, useResetExecutivePassword } from '../api/executives.js';
import { useAuth } from '../context/AuthContext.jsx';
```

(This replaces the existing `import { useExecutives, useCreateExecutive, useDeleteExecutive } from '../api/executives.js';` line — same import, one more named export plus the new `useAuth` import on its own line.)

Replace the full `ExecutivesPanel` function (from `function ExecutivesPanel() {` through its closing `}`) with:

```js
function UsersPanel() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const { data: users = [] } = useExecutives();
  const createUser = useCreateExecutive();
  const resetPassword = useResetExecutivePassword();
  const deleteUser = useDeleteExecutive();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(null);

  async function onAdd() {
    setError('');
    try {
      const created = await createUser.mutateAsync({ name, email });
      setName(''); setEmail('');
      setRevealed({ email: created.email, tempPassword: created.tempPassword });
    } catch (err) { setError(err.message); }
  }

  async function onResetPassword(u) {
    setError('');
    if (!window.confirm(`¿Restablecer la contraseña de "${u.name}"?`)) return;
    try {
      const result = await resetPassword.mutateAsync(u.id);
      setRevealed({ email: u.email, tempPassword: result.tempPassword });
    } catch (err) { setError(err.message); }
  }

  async function onDelete(u) {
    setError('');
    if (!window.confirm(`¿Eliminar el usuario "${u.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteUser.mutateAsync(u.id);
    } catch (err) { setError(err.message); }
  }

  async function onCopyPassword() {
    if (!revealed) return;
    try { await navigator.clipboard.writeText(revealed.tempPassword); } catch { /* clipboard unavailable — the text is still visible to select manually */ }
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Usuarios</h2>
      {revealed && (
        <div className="mb-3 rounded-md border border-ui-accent bg-ui-accent/5 p-2.5 text-xs">
          <p className="mb-1">Contraseña temporal para <strong>{revealed.email}</strong>: <code className="font-mono">{revealed.tempPassword}</code></p>
          <p className="mb-2 text-text-secondary">Cópiala ahora — no se volverá a mostrar.</p>
          <div className="flex gap-2">
            <Button type="button" size="small" onClick={onCopyPassword}>Copiar</Button>
            <Button type="button" size="small" onClick={() => setRevealed(null)}>Cerrar</Button>
          </div>
        </div>
      )}
      <ul className="text-sm">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between border-t border-border py-1.5 first:border-t-0">
            <div className="flex flex-col">
              <span className="flex items-center gap-1">
                <span>{u.name}</span>
                {u.role === 'owner' && <span className="text-[10px] uppercase text-ui-accent">Owner</span>}
              </span>
              <span className="text-xs text-text-secondary">{u.email}</span>
            </div>
            {isOwner && (
              <span className="flex shrink-0 gap-1">
                <Button type="button" size="small" aria-label={`Restablecer contraseña de ${u.name}`} onClick={() => onResetPassword(u)}>
                  Restablecer contraseña
                </Button>
                {String(u.id) !== String(user.id) && (
                  <Button aria-label={`Eliminar usuario ${u.name}`} variant="danger" size="small" className="px-2" onClick={() => onDelete(u)}>
                    <TrashIcon />
                  </Button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {isOwner && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="nu_name" className="mb-1 block text-xs text-text-secondary">Nombre del usuario</label>
              <Input id="nu_name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="nu_email" className="mb-1 block text-xs text-text-secondary">Correo del usuario</label>
              <Input id="nu_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <Button className="mt-2" disabled={createUser.isPending} onClick={onAdd}>
            {createUser.isPending ? 'Guardando…' : 'Crear usuario'}
          </Button>
        </div>
      )}
    </Card>
  );
}
```

Finally, in the `CatalogoPage` component at the bottom of the file, replace `<ExecutivesPanel />` with `<UsersPanel />`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/CatalogoPage.test.jsx` (from `frontend/`)
Expected: PASS — all tests.

- [ ] **Step 6: Run the full frontend test suite and build**

Run: `npx vitest run` (from `frontend/`)
Expected: some failures remain in `NuevaCotizacionPage.test.jsx` — **this is expected and fixed in Task 5.** Confirm no other file regresses.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/executives.js frontend/src/pages/CatalogoPage.jsx frontend/src/pages/CatalogoPage.test.jsx
git commit -m "feat: rebuild the Ejecutivos panel as an owner-managed Usuarios panel"
```

---

### Task 5: Frontend — remove the inline "+ Nuevo ejecutivo" quick-add

**Files:**
- Modify: `frontend/src/pages/NuevaCotizacionPage.jsx`
- Modify: `frontend/src/pages/NuevaCotizacionPage.test.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: the "Ejecutivo comercial" `<Select>` in Nueva cotización only lists existing users — no "+ Nuevo ejecutivo" option, no inline create form.

- [ ] **Step 1: Remove the two obsolete tests**

In `frontend/src/pages/NuevaCotizacionPage.test.jsx`, delete these two `it(...)` blocks in full:
- `it('saves a new executive on demand, without waiting for the quotation to be submitted', async () => { ... })`
- `it('shows the server error inline when saving a new executive fails', async () => { ... })`

(These test the `__new__` quick-add flow being removed in this task. Leave every other test in the file untouched — in particular, the mocked `/executives` fixture list and the tests that just *select* an existing executive by id, e.g. `await userEvent.selectOptions(screen.getByLabelText('Ejecutivo comercial'), '1')`, stay exactly as they are.)

- [ ] **Step 2: Run the file to confirm the remaining tests still pass before touching the component**

Run: `npx vitest run src/pages/NuevaCotizacionPage.test.jsx` (from `frontend/`)
Expected: PASS — removing tests for code you haven't touched yet shouldn't break anything; this just confirms your test-file edit was clean before you change the component under test.

- [ ] **Step 3: Remove the quick-add from the component**

In `frontend/src/pages/NuevaCotizacionPage.jsx`:

Change the import line:

```js
import { useExecutives, useCreateExecutive } from '../api/executives.js';
```

to:

```js
import { useExecutives } from '../api/executives.js';
```

Remove the `createExecutive` hook call:

```js
  const createExecutive = useCreateExecutive();
```

Remove the `newExecName` state declaration:

```js
  const [newExecName, setNewExecName] = useState('');
```

Remove the `createNewExecutive` and `onSaveNewExecutive` functions in full (both function bodies, from `async function createNewExecutive() {` through the closing `}` of `onSaveNewExecutive`):

```js
  async function createNewExecutive() {
    if (!newExecName.trim()) { setError('Ingresa el nombre del ejecutivo nuevo.'); return null; }
    try {
      return await createExecutive.mutateAsync({ name: newExecName });
    } catch (err) { setError(err.message); return null; }
  }

  async function onSaveNewExecutive() {
    setError('');
    const created = await createNewExecutive();
    if (!created) return;
    setExecutiveId(String(created.id));
    setNewExecName('');
  }
```

In `onSubmit`, simplify the executive-selection block from:

```js
    let finalExecutiveId = executiveId;
    if (executiveId === '__new__') {
      const created = await createNewExecutive();
      if (!created) return;
      finalExecutiveId = String(created.id);
    } else if (!executiveId) {
      setError('Selecciona o crea un ejecutivo.'); return;
    }
```

to:

```js
    if (!executiveId) {
      setError('Selecciona un ejecutivo.'); return;
    }
```

And update the payload build just below (which currently reads `executiveId: finalExecutiveId`) to use `executiveId` directly:

```js
    const payload = {
      clientId: finalClientId, pais, lineaServicio: effectiveLinea, executiveId,
      proyecto: proyecto.trim(), descripcion, detalle: cleanDetalle,
      monto: montoNum, impuestos, moneda, validezDias: parseInt(validezDias, 10) || 30
    };
```

Remove the `+ Nuevo ejecutivo` option from the `<Select>`:

```jsx
              <Select id="f_ejecutivo" value={executiveId} onChange={(e) => setExecutiveId(e.target.value)}>
                <option value="">Selecciona…</option>
                {executives.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
```

(drops the trailing `<option value="__new__">+ Nuevo ejecutivo</option>` line)

Remove the entire conditional block that rendered the inline create form:

```jsx
          {executiveId === '__new__' && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input aria-label="Nombre del ejecutivo nuevo" placeholder="Nombre completo" value={newExecName} onChange={(e) => setNewExecName(e.target.value)} />
              </div>
              <Button type="button" size="small" disabled={createExecutive.isPending} onClick={onSaveNewExecutive}>
                {createExecutive.isPending ? 'Guardando…' : 'Guardar ejecutivo'}
              </Button>
            </div>
          )}
```

Do NOT touch the equivalent client quick-add (`clientId === '__new__'`, `createNewClient`, `onSaveNewClient`, the `+ Nuevo cliente` option) — that flow is untouched by this plan; only the executive one is removed.

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx vitest run src/pages/NuevaCotizacionPage.test.jsx` (from `frontend/`)
Expected: PASS — all remaining tests.

- [ ] **Step 5: Run the full frontend test suite and build**

Run: `npx vitest run` (from `frontend/`)
Expected: PASS — every file, no regressions anywhere in the app.

Run: `npm run build` (from `frontend/`)
Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/NuevaCotizacionPage.jsx frontend/src/pages/NuevaCotizacionPage.test.jsx
git commit -m "feat: remove inline executive quick-add from Nueva cotización"
```

---

## After all tasks: production role backfill and deploy

This branch (`worktree-backend-implementation`) has been pushed straight to `main` for every change this session, which auto-deploys both Railway (backend) and Vercel (frontend). Once all 5 tasks are committed:

1. Push to both `worktree-backend-implementation` and `main`.
2. Confirm the Railway deployment succeeds and the migration log shows the new migration applied with no errors.
3. **One-off manual step, not part of the app's code:** the existing production admin account was created before `role` existed, so the migration's `DEFAULT 'executive'` applies to it too — it needs to be promoted to `role = 'owner'` once, directly against `vaovao_prod`, the same way the earlier production-data-reset was done (a gated one-off script triggered via a temporary `railway.json` startCommand change, run once, then reverted — see project memory for the exact established pattern). Verify afterward with a real login as that account and confirm the Usuarios panel shows the "Crear usuario" form.

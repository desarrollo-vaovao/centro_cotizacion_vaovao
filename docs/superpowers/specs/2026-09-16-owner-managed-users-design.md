# Owner-managed users (merge Ejecutivos into login accounts) — design

Date: 2026-09-16
Status: approved

## Context

Following the "forced password change on first login" feature, the user
wants an in-app way to create teammate accounts instead of asking Claude to
run a one-off script every time ("de ahi puede crear ejecutivos y ahi
podemos agregarles contraseñas aleatorias, pasarles las credenciales y solo
ingresen ponerle el pop up de cambiar contraseña").

Brainstorming surfaced that the app already has an "Ejecutivos" concept
(`executives` table: id + name only, used purely to attribute a quotation to
a person for reporting — no login) sitting right next to the real `users`
login table. The user confirmed these should become the same thing: every
"ejecutivo" is now also a login account, and the panel that manages them
lives in Configuración, gated so only the current admin account (now called
the **owner**) can create accounts or reset passwords.

Production was reset to empty data on 2026-09-16 (see project memory), which
made this the right moment to do a clean merge instead of a bolt-on: rather
than keeping two parallel "person" tables, `executives` is retired and
`users` becomes the single source of truth for both login and quotation
attribution.

## Scope decided during brainstorming

- **Ejecutivos and Usuarios are the same table.** No separate "Usuarios"
  list — the existing Ejecutivos panel becomes the user-management panel.
- **Two roles: `owner` and `executive`.** The only permission difference
  anywhere in the app is who can create accounts, reset passwords, and
  delete accounts (all owner-only). Everything else — quotations, clients,
  dashboard, catalog — stays exactly as shared/visible to everyone as today
  (no broader permission system, no data scoping by role).
- **Passwords are always system-generated**, shown once in the UI at
  creation/reset time, never re-viewable — the owner copies it and shares it
  with the teammate manually (WhatsApp, Slack, etc.), same handoff as the
  first owner account. Reuses the existing forced-password-change-on-first-
  login flow (`must_change_password`) built earlier.
- **The inline "+ Nuevo ejecutivo" quick-add inside Nueva cotización is
  removed.** It let anyone spontaneously create an executive with just a
  name; that's incompatible with executives now being real login accounts
  that only the owner may create. Quotations can only be assigned to an
  already-existing user.
- **A user cannot delete their own account.**

## Data model

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'executive';
```

The existing admin account is promoted to `role = 'owner'` as a one-off
manual step after this migration ships (same pattern as the earlier
production-data-reset: a gated script run once against production, not part
of the app's normal code path — see project memory for the established
technique). New accounts created through the panel default to `'executive'`.

`executives` is dropped and `quotations.executive_id` is repointed to
`users(id)`:

```sql
DROP TABLE IF EXISTS executives CASCADE;
-- (idempotent add — see plan for the exact guarded DO block, since this
-- runner has no migration ledger yet and every file re-runs on every boot)
ALTER TABLE quotations ADD CONSTRAINT quotations_executive_id_fkey
  FOREIGN KEY (executive_id) REFERENCES users(id);
```

The FK's existing behavior is unchanged: deleting a user who has quotations
attributed to them is blocked (Postgres FK violation, surfaced today by
`backend/src/routes/executives.js` as a 409 with a friendly message) — that
error handling carries over unmodified.

## Backend

- `POST /auth/login` and `GET /auth/me` responses gain `role` alongside the
  existing `mustChangePassword` field, read straight from `users.role`.
- The session gains `req.session.role`, set at login time (same lightweight
  pattern already used for `req.session.csrfToken` — cached for the session's
  lifetime rather than re-queried every request, consistent with how
  `requireAuth` already only checks `req.session.userId` without hitting the
  DB).
- New `requireOwner` middleware: 403s with a generic Spanish message unless
  `req.session.role === 'owner'`.
- `backend/src/routes/executives.js` (route path stays `/executives` — no
  frontend consumer outside the management panel needs to change) now reads
  from `users` instead of `executives`:
  - `GET /executives` — unrestricted to any authenticated user (matches
    today's behavior; the quotation form's dropdown and the dashboard's
    per-executive ranking both depend on this being universally readable).
    Returns `id, name, email, role` for every row.
  - `POST /executives` — **owner-only.** Body `{ name, email }`. Generates a
    random password server-side (new `generateTempPassword()` helper next to
    `hashPassword`/`verifyPassword`), hashes it, inserts with
    `role = 'executive'`, `must_change_password = true`. Returns
    `{ id, name, email, role, tempPassword }` — `tempPassword` appears in
    this one response only.
  - `POST /executives/:id/reset-password` — **owner-only.** Same generation,
    updates the existing row's hash and sets `must_change_password = true`.
    Returns `{ tempPassword }` once.
  - `DELETE /executives/:id` — **owner-only.** Same FK-violation-to-409
    handling as today. Additionally 400s with a clear message if
    `req.params.id == req.session.userId` (no self-delete).
- `backend/src/routes/dashboard.js`'s executive-name lookup
  (`SELECT id, name FROM executives`) becomes `SELECT id, name FROM users`.
- `backend/src/seed.js` sets `role = 'owner'` when it creates/updates the
  admin account (this script is what provisions a brand-new environment's
  first account, so it should always produce an owner).

## Frontend

- `frontend/src/pages/CatalogoPage.jsx`'s `ExecutivesPanel` is renamed
  (in the UI, card title "Usuarios") and rebuilt:
  - Table/list of every user: name, email, role badge.
  - If the logged-in user's `role` is `'owner'` (from `AuthContext`'s
    `user.role`, following the same shape as `mustChangePassword` added
    earlier): show a "Crear usuario" form (name + email) and, per row, a
    "Restablecer contraseña" button and a delete button (hidden on the
    owner's own row).
  - If not owner: read-only list, no management controls.
  - Creating a user or resetting a password opens a small dismissible panel
    showing the returned `tempPassword` with a copy-to-clipboard button and
    a one-line warning that it will not be shown again.
- `frontend/src/pages/NuevaCotizacionPage.jsx`: remove the `__new__` option
  from the ejecutivo `<Select>`, the `newExecName` state, `createNewExecutive`,
  and `onSaveNewExecutive` — the dropdown only lists existing users going
  forward. (The equivalent "+ Nuevo cliente" quick-add for clients is
  untouched — this change is scoped to executives only.)
- `AuthContext`'s `user` object gains `role`, following straight through
  from `/auth/login` and `/auth/me` (no new context method needed — `role`
  is read directly off `user`, same as `mustChangePassword`).

## Out of scope (explicitly deferred, not silently dropped)

- Any permission difference beyond account management (still one shared
  view of all data for every role).
- Self-service password reset/"forgot password" for the owner themselves —
  still a manual DB fix if that's ever needed (extremely unlikely, single
  owner account).
- More than two roles, or per-user granular permissions.
- Editing a user's name/email after creation (only create, reset password,
  delete are in scope).
- **Email format validation** on user creation — any non-empty string is
  accepted as the login email today.
- **Only one path exists to create an owner:** the seed script
  (`backend/src/seed.js`), which always sets `role = 'owner'`. There is no
  in-app way to promote an existing account, so if the sole owner account is
  ever lost, recovery is re-running the seed script against production
  (same recovery path as a lost admin password) — same bus-factor tradeoff
  accepted for the single admin account before this feature existed.
- **Resetting your own password** (an owner can target their own row from
  the Usuarios panel) forces that account through the change-password flow
  on its next login, same as anyone else's reset — the confirm dialog
  doesn't call this out specially, so it's worth knowing before clicking it
  on your own row.

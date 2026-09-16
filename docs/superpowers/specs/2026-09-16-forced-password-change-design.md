# Forced password change on first login — design

Date: 2026-09-16
Status: approved

## Context

Centro de Cotizaciones has one shared login today, created manually. The team
wants individual accounts per person ("cada uno quiere tener su usuario").
The `users` table already supports multiple accounts with no schema change
needed for that part — the gap is only in how a new account's first login
works.

Scope decided during brainstorming:

- **Data stays shared.** Every logged-in user still sees and manages the same
  clients/quotations/executives as today. This is not multi-tenancy.
- **Account creation stays manual.** No self-registration, no in-app "manage
  users" screen. When new teammates need accounts, the user gives Claude a
  list of name + email, and Claude runs a one-off script (same pattern as the
  production-data-reset script from 2026-09-16) to create each account with a
  random temporary password, then hands the credentials to the user in chat
  to share manually (WhatsApp, Slack, etc.).
- **No automated invitation email for v1.** Sending mail requires picking and
  configuring an email provider (Resend, SendGrid, Google Workspace SMTP,
  etc.) with real credentials the user would need to supply — deferred until
  the user wants that setup.

What this spec covers: the one piece of actual product behavior needed to
make manually-issued temporary passwords safe — forcing the person to set
their own password the first time they log in with one.

## Data model

Add one column to `users`:

```sql
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
```

Existing accounts (the admin account) default to `false` — unaffected.
Accounts created by the manual provisioning script are inserted with
`must_change_password = true`.

## Backend

- `POST /auth/login` and `GET /auth/me` responses include `mustChangePassword`
  on the user object (alongside `id`, `email`, `name`), read straight from the
  column.
- New `POST /auth/change-password` (requires an authenticated session +
  CSRF token, same as other mutating routes):
  - Body: `{ currentPassword, newPassword }`.
  - Verifies `currentPassword` against the stored hash with the same
    `verifyPassword` helper login uses — this is what stops a stolen session
    cookie alone from being enough to take over the account.
  - Rejects `newPassword` shorter than 8 characters (matches no weaker
    standard existing in the app; simplest reasonable floor).
  - Hashes and stores the new password, sets `must_change_password = false`.
  - Does not rotate or destroy the session — the user stays logged in and
    lands in the app immediately after.
  - Wrong `currentPassword` → 401 with a generic "Contraseña actual
    incorrecta." (mirrors the login endpoint's generic-error convention).

No changes to the login rate limiter or session handling beyond exposing the
new field.

## Frontend

- `ProtectedRoute` gains a second check: once `status === 'authenticated'`,
  if `user.mustChangePassword` is true and the current path isn't
  `/cambiar-contrasena`, redirect there. This blocks every other route
  (Dashboard, Nueva cotización, etc.) until the password is changed — matches
  how `/login` already redirects anonymous users.
- New `ChangePasswordPage.jsx`, reachable only via that redirect (no nav
  link): three fields — contraseña actual (temporal), nueva contraseña,
  confirmar nueva contraseña. Client-side check that the two new-password
  fields match before submitting; server is still the source of truth for the
  length rule.
- On success, `AuthContext` updates the in-memory `user.mustChangePassword` to
  `false` (no need to re-fetch `/auth/me`) and the redirect in
  `ProtectedRoute` naturally stops firing, so the person lands on
  `/dashboard`.
- Existing "Cerrar sesión" button keeps working from this screen (in case
  someone wants to log out instead of changing their password right now).

## Out of scope (explicitly deferred, not silently dropped)

- Self-service "forgot password" — still a manual reset by Claude, as today.
- A voluntary "change my password" entry point for already-onboarded users
  (only reachable today via the forced first-login redirect). Can reuse the
  same page/endpoint later if wanted.
- Automated invitation email.
- Any in-app user management (create/deactivate accounts, roles/permissions).

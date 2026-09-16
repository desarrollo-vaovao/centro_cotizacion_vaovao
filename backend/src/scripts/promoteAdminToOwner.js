import { pool } from '../db.js';

// One-off maintenance script: promotes the production admin account (the
// one provisioned by the original seed script) to role='owner', since it
// was created before `role` existed and defaulted to 'executive'. Only
// runs when explicitly armed via env var so a normal redeploy never
// triggers it by accident.
async function main() {
  if (process.env.PROMOTE_ADMIN_TO_OWNER !== 'confirm') {
    console.log('[promote] PROMOTE_ADMIN_TO_OWNER not set to "confirm" — skipping.');
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.error('[promote] ADMIN_EMAIL is not set — cannot target the right account.');
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const before = await pool.query('SELECT id, email, role FROM users ORDER BY id');
  console.log('[promote] before:', before.rows);

  const { rowCount } = await pool.query(
    `UPDATE users SET role = 'owner' WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  console.log(`[promote] updated ${rowCount} row(s) for ${email}`);

  const after = await pool.query('SELECT id, email, role FROM users ORDER BY id');
  console.log('[promote] after:', after.rows);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[promote] failed:', err);
    pool.end().finally(() => process.exit(1));
  });

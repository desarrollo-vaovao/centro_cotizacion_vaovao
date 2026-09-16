import { pool } from '../db.js';

// One-off maintenance script: wipes quotations/clients/executives and
// resets the correlativo counter, leaving users, service_lines and
// settings.logo_* untouched. Only runs when explicitly armed via env var
// so a normal redeploy never triggers it by accident.
async function main() {
  if (process.env.RESET_TRANSACTIONAL_DATA !== 'confirm') {
    console.log('[reset] RESET_TRANSACTIONAL_DATA not set to "confirm" — skipping.');
    return;
  }

  const before = await pool.query(`
    SELECT
      (SELECT count(*) FROM quotations) AS quotations,
      (SELECT count(*) FROM clients) AS clients,
      (SELECT count(*) FROM executives) AS executives,
      (SELECT count(*) FROM users) AS users,
      (SELECT count(*) FROM service_lines) AS service_lines,
      (SELECT general_seq FROM settings WHERE id = 1) AS general_seq
  `);
  console.log('[reset] before:', before.rows[0]);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Postgres refuses to TRUNCATE a table another table has an FK into
    // unless both are truncated in the same statement, regardless of
    // truncation order across separate statements.
    await client.query('TRUNCATE TABLE quotations, clients, executives RESTART IDENTITY');
    await client.query('UPDATE settings SET general_seq = 0 WHERE id = 1');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const after = await pool.query(`
    SELECT
      (SELECT count(*) FROM quotations) AS quotations,
      (SELECT count(*) FROM clients) AS clients,
      (SELECT count(*) FROM executives) AS executives,
      (SELECT count(*) FROM users) AS users,
      (SELECT count(*) FROM service_lines) AS service_lines,
      (SELECT general_seq FROM settings WHERE id = 1) AS general_seq
  `);
  console.log('[reset] after:', after.rows[0]);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[reset] failed:', err);
    pool.end().finally(() => process.exit(1));
  });

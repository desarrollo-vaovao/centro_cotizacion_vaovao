import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../src/db.js';
import { resetDb } from './helpers/index.js';

describe('migrations', () => {
  beforeEach(async () => {
    await resetDb();
  });

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

  it('nulls out orphaned quotations.executive_id values before re-adding the FK, instead of crashing', async () => {
    // Simulate a database that still has a quotation pointing at an id that
    // no longer exists in users (e.g. an id that used to live in the
    // now-dropped executives table). We have to drop the FK constraint
    // first since it's already in place from the initial migration run in
    // globalSetup — this recreates the pre-migration state the fix guards
    // against, it doesn't bypass anything the migration itself relies on.
    await pool.query('ALTER TABLE quotations DROP CONSTRAINT quotations_executive_id_fkey');
    const { rows } = await pool.query(
      `INSERT INTO quotations (correlativo_general, pais, linea_servicio, executive_id, proyecto, monto)
       VALUES ('PC-2026-999', 'Guatemala', 'Video', 999999, 'Proyecto huérfano', 100)
       RETURNING id`
    );
    const orphanId = rows[0].id;

    const { runMigrations } = await import('../src/migrations/run.js');
    await expect(runMigrations()).resolves.not.toThrow();

    const { rows: after } = await pool.query('SELECT executive_id FROM quotations WHERE id = $1', [orphanId]);
    expect(after[0].executive_id).toBeNull();
  });
});

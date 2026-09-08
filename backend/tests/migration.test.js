import { describe, it, expect } from 'vitest';
import { pool } from '../src/db.js';

describe('migrations', () => {
  it('creates all expected tables', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const names = rows.map((r) => r.table_name);
    for (const t of ['users', 'clients', 'executives', 'service_lines', 'quotations', 'settings']) {
      expect(names).toContain(t);
    }
  });

  it('seeds the single settings row', async () => {
    const { rows } = await pool.query('SELECT general_seq FROM settings WHERE id = 1');
    expect(rows[0].general_seq).toBe(0);
  });
});

import pg from 'pg';
import 'dotenv/config';

// Postgres DATE columns come back as JS Date objects by default, which get
// shifted through UTC on toISOString(). We keep them as plain 'YYYY-MM-DD'
// strings instead so calendar-date logic (dashboard periods, correlativos)
// never depends on the process timezone.
pg.types.setTypeParser(1082, (val) => val);

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
});

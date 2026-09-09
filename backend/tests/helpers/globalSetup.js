process.env.TZ = 'America/Guatemala';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

const { runMigrations } = await import('../../src/migrations/run.js');
await runMigrations();

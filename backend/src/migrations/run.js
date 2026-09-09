import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const sql = readFileSync(path.join(__dirname, '001_init.sql'), 'utf8');
  await pool.query(sql);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(async () => { console.log('Migraciones aplicadas.'); await pool.end(); })
    .catch((err) => { console.error(err); process.exit(1); });
}

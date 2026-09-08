import 'dotenv/config';
import { pool } from './db.js';
import { hashPassword } from './utils/password.js';

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!email || !password) {
    console.error('Define ADMIN_EMAIL y ADMIN_PASSWORD en el entorno antes de sembrar.');
    process.exit(1);
  }
  try {
    const passwordHash = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
      [email.toLowerCase().trim(), passwordHash, name]
    );
    console.log(`Usuario ${email} listo.`);
  } catch (error) {
    console.error(`Error al crear el usuario ${email}:`, error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();

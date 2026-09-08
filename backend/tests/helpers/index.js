import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { hashPassword } from '../../src/utils/password.js';

export function makeAgent() {
  return request.agent(createApp());
}

export async function resetDb() {
  await pool.query('TRUNCATE quotations, clients, executives, service_lines RESTART IDENTITY CASCADE');
  await pool.query('UPDATE settings SET general_seq = 0, logo_agencia = NULL, logo_velarc = NULL WHERE id = 1');
}

export async function seedTestUser() {
  const passwordHash = await hashPassword('Test1234!');
  await pool.query(
    `INSERT INTO users (email, password_hash, name) VALUES ('test@vaovao.co', $1, 'Test User')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [passwordHash]
  );
}

export async function loginAgent(agent) {
  const res = await agent.post('/auth/login').send({ email: 'test@vaovao.co', password: 'Test1234!' });
  return res.body.csrfToken;
}

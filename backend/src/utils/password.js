import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

const ROUNDS = 12;
// Excludes visually ambiguous characters (0/O, 1/l/I) since temp passwords
// get hand-copied and shared over chat — a small kindness to whoever has to
// type this in.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMP_PASSWORD_LENGTH = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function generateTempPassword() {
  let out = '';
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    out += TEMP_PASSWORD_ALPHABET[crypto.randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

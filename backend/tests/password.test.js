import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateTempPassword } from '../src/utils/password.js';

describe('password utils', () => {
  it('hashes a password and verifies the correct plain text against it', async () => {
    const hash = await hashPassword('Test1234!');
    expect(hash).not.toBe('Test1234!');
    expect(await verifyPassword('Test1234!', hash)).toBe(true);
  });

  it('rejects an incorrect plain text password', async () => {
    const hash = await hashPassword('Test1234!');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('generates a 12-character temporary password with no ambiguous characters', () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(12);
    expect(pw).not.toMatch(/[0O1lI]/);
  });

  it('generates a different password on each call', () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword());
  });
});

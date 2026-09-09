import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

describe('password hashing', () => {
  it('hashes a password and verifies the correct plain text against it', async () => {
    const hash = await hashPassword('Test1234!');
    expect(hash).not.toBe('Test1234!');
    expect(await verifyPassword('Test1234!', hash)).toBe(true);
  });

  it('rejects an incorrect plain text password', async () => {
    const hash = await hashPassword('Test1234!');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from 'src/auth/password';

describe('password', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('password123');

    await expect(verifyPassword(hash, 'password123')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('password123');

    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('produces a different hash for the same password each time (salted)', async () => {
    const hashA = await hashPassword('password123');
    const hashB = await hashPassword('password123');

    expect(hashA).not.toBe(hashB);
  });
});

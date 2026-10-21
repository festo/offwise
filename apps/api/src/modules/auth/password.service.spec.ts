import { hash } from '@node-rs/argon2';
import { describe, expect, it } from 'vitest';
import { ARGON2_OPTIONS, PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id', async () => {
    expect(await service.hash('correct horse battery')).toMatch(/^\$argon2id\$/);
  });

  it('verifies right and wrong passwords', async () => {
    const h = await service.hash('correct horse battery');
    expect(await service.verify(h, 'correct horse battery')).toBe(true);
    expect(await service.verify(h, 'wrong password!!')).toBe(false);
  });

  it('returns false for a null hash', async () => {
    expect(await service.verify(null, 'x')).toBe(false);
  });

  it('detects outdated parameters', async () => {
    expect(service.needsRehash(await service.hash('abcdefghijkl'))).toBe(false);
    const weak = await hash('abcdefghijkl', { ...ARGON2_OPTIONS, timeCost: 1 });
    expect(service.needsRehash(weak)).toBe(true);
  });

  it('flags non-argon2id hashes and wrong versions for rehash', async () => {
    const argon2i = await hash('abcdefghijkl', { ...ARGON2_OPTIONS, algorithm: 1 });
    expect(service.needsRehash(argon2i)).toBe(true);
    const good = await service.hash('abcdefghijkl');
    expect(service.needsRehash(good.replace('v=19', 'v=16'))).toBe(true);
  });

  it('flags unparseable hashes for rehash', () => {
    expect(service.needsRehash('not-a-hash')).toBe(true);
  });

  it('precomputes the dummy hash on module init', async () => {
    const s = new PasswordService();
    await s.onModuleInit();
    expect(await s.verify(null, 'x')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { credentialFingerprint, hashToken } from './tokens';

describe('credentialFingerprint', () => {
  it('is the SHA-256 hex of the password hash', () => {
    expect(credentialFingerprint('$argon2id$v=19$abc')).toBe(hashToken('$argon2id$v=19$abc'));
  });

  it('differs when the password hash changes', () => {
    expect(credentialFingerprint('hash-a')).not.toBe(credentialFingerprint('hash-b'));
  });
});

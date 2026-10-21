import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSecretBox } from './secret-box';

const key = () => randomBytes(32).toString('base64');

describe('createSecretBox', () => {
  it('round-trips and prefixes with v1.', () => {
    const box = createSecretBox(key());
    const sealed = box.encrypt('hello');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(box.decrypt(sealed)).toBe('hello');
  });
  it('produces different output for the same input', () => {
    const box = createSecretBox(key());
    expect(box.encrypt('x')).not.toBe(box.encrypt('x'));
  });
  it('throws on tampered ciphertext', () => {
    const box = createSecretBox(key());
    const parts = box.encrypt('secret').split('.');
    parts[3] = Buffer.from('tampered!').toString('base64url');
    expect(() => box.decrypt(parts.join('.'))).toThrow();
  });
  it('throws with the wrong key', () => {
    const sealed = createSecretBox(key()).encrypt('secret');
    expect(() => createSecretBox(key()).decrypt(sealed)).toThrow();
  });
  const tamper = (index: number, mutate: (b: Buffer) => Buffer) => {
    const box = createSecretBox(key());
    const parts = box.encrypt('secret').split('.');
    parts[index] = mutate(Buffer.from(parts[index]!, 'base64url')).toString('base64url');
    return () => box.decrypt(parts.join('.'));
  };
  const flip = (b: Buffer) => {
    b[0] = b[0]! ^ 1;
    return b;
  };
  it('throws when a tag byte is flipped', () => {
    expect(tamper(2, flip)).toThrow();
  });
  it('throws when an iv byte is flipped', () => {
    expect(tamper(1, flip)).toThrow();
  });
  it('throws on a truncated tag', () => {
    expect(tamper(2, (b) => b.subarray(0, 4))).toThrow();
  });
  it('throws on a wrong iv length', () => {
    expect(tamper(1, (b) => b.subarray(0, 8))).toThrow();
  });
  it('throws on wrong part count', () => {
    const box = createSecretBox(key());
    expect(() => box.decrypt(`${box.encrypt('x')}.extra`)).toThrow();
    expect(() => box.decrypt('v1.a.b')).toThrow();
  });
  it('throws on wrong version prefix', () => {
    const box = createSecretBox(key());
    expect(() => box.decrypt(box.encrypt('x').replace('v1.', 'v2.'))).toThrow();
  });
});

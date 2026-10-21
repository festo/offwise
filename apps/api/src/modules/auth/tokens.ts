import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes, base64url. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex. Redis only ever stores hashes of session ids and reset tokens. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

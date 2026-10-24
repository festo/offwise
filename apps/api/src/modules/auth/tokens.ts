import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes, base64url. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex. Redis only ever stores hashes of session ids and reset tokens. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Identifies the credentials a session was created with. A session whose fingerprint no longer
 * matches the user's current password hash is invalid, so a password change ends every session,
 * including one a racing login stored after the change.
 */
export function credentialFingerprint(passwordHash: string): string {
  return hashToken(passwordHash);
}

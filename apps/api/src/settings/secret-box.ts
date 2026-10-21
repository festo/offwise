import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface SecretBox {
  encrypt(plain: string): string;
  decrypt(sealed: string): string;
}

/** AES-256-GCM. Format: `v1.<iv b64url>.<tag b64url>.<ciphertext b64url>`. */
export function createSecretBox(base64Key: string): SecretBox {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes');

  return {
    encrypt(plain) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
      const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [
        'v1',
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        data.toString('base64url'),
      ].join('.');
    },
    decrypt(sealed) {
      const [version, iv, tag, data, ...rest] = sealed.split('.');
      if (version !== 'v1' || !iv || !tag || data === undefined || rest.length > 0) {
        throw new Error('Malformed sealed value');
      }
      const ivBytes = Buffer.from(iv, 'base64url');
      const tagBytes = Buffer.from(tag, 'base64url');
      if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) {
        throw new Error('Malformed sealed value');
      }
      const decipher = createDecipheriv('aes-256-gcm', key, ivBytes, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAuthTag(tagBytes);
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}

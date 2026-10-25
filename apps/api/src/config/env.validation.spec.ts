import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

const DB = 'postgresql://u:p@localhost:5432/x';

const BASE = {
  NODE_ENV: 'test',
  DATABASE_URL: DB,
  REDIS_URL: 'redis://localhost:6379/0',
  PUBLIC_URL: 'http://localhost:5173',
  SESSION_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'offwise <noreply@offwise.local>',
};

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv(BASE);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('converts PORT from a string', () => {
    expect(validateEnv({ ...BASE, NODE_ENV: 'production', PORT: '8080' }).PORT).toBe(8080);
  });

  it('treats blank optional variables as unset', () => {
    const env = validateEnv({ ...BASE, PORT: '', LOG_LEVEL: '' });
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  describe('session lifetime', () => {
    it('defaults to a 7-day idle timeout and a 30-day maximum age', () => {
      const env = validateEnv(BASE);
      expect(env.SESSION_IDLE_TIMEOUT_DAYS).toBe(7);
      expect(env.SESSION_MAX_AGE_DAYS).toBe(30);
    });

    it('accepts whole days', () => {
      const env = validateEnv({
        ...BASE,
        SESSION_IDLE_TIMEOUT_DAYS: '1',
        SESSION_MAX_AGE_DAYS: '14',
      });
      expect(env.SESSION_IDLE_TIMEOUT_DAYS).toBe(1);
      expect(env.SESSION_MAX_AGE_DAYS).toBe(14);
    });

    it('rejects zero, fractions and values over a year', () => {
      for (const value of ['0', '1.5', '366', 'week']) {
        expect(() => validateEnv({ ...BASE, SESSION_IDLE_TIMEOUT_DAYS: value })).toThrow(
          /SESSION_IDLE_TIMEOUT_DAYS/,
        );
        expect(() => validateEnv({ ...BASE, SESSION_MAX_AGE_DAYS: value })).toThrow(
          /SESSION_MAX_AGE_DAYS/,
        );
      }
    });

    it('rejects an idle timeout longer than the maximum age', () => {
      expect(() =>
        validateEnv({ ...BASE, SESSION_IDLE_TIMEOUT_DAYS: '10', SESSION_MAX_AGE_DAYS: '5' }),
      ).toThrow(/SESSION_IDLE_TIMEOUT_DAYS/);
    });
  });

  it('drops variables it does not know', () => {
    expect(validateEnv({ ...BASE, PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });

  it('rejects a missing NODE_ENV with a prefixed message naming the variable', () => {
    expect(() => validateEnv({})).toThrow(/^Invalid environment configuration: .*NODE_ENV/);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ ...BASE, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ ...BASE, PORT: '70000' })).toThrow(/PORT/);
  });

  it('requires DATABASE_URL to be a postgres connection string', () => {
    expect(() => validateEnv({ ...BASE, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...BASE, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
    expect(validateEnv(BASE).DATABASE_URL).toBe(DB);
  });

  it('requires REDIS_URL to be a redis:// or rediss:// URL', () => {
    expect(() => validateEnv({ ...BASE, REDIS_URL: undefined })).toThrow(/REDIS_URL/);
    expect(() => validateEnv({ ...BASE, REDIS_URL: 'http://x' })).toThrow(/REDIS_URL/);
    expect(validateEnv({ ...BASE, REDIS_URL: 'rediss://h:6380/1' }).REDIS_URL).toBe(
      'rediss://h:6380/1',
    );
  });

  it('requires PUBLIC_URL to be an absolute http(s) URL and strips trailing slashes', () => {
    expect(() => validateEnv({ ...BASE, PUBLIC_URL: 'localhost:5173' })).toThrow(/PUBLIC_URL/);
    expect(() => validateEnv({ ...BASE, PUBLIC_URL: 'ftp://x.test' })).toThrow(/PUBLIC_URL/);
    expect(validateEnv({ ...BASE, PUBLIC_URL: 'https://offwise.test/' }).PUBLIC_URL).toBe(
      'https://offwise.test',
    );
  });

  it('rejects a SESSION_SECRET shorter than 32 characters', () => {
    expect(() => validateEnv({ ...BASE, SESSION_SECRET: 'x'.repeat(31) })).toThrow(
      /SESSION_SECRET/,
    );
    expect(() => validateEnv({ ...BASE, SESSION_SECRET: undefined })).toThrow(/SESSION_SECRET/);
  });

  it('requires ENCRYPTION_KEY to be base64 for exactly 32 bytes', () => {
    const key = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64');
    expect(() => validateEnv({ ...BASE, ENCRYPTION_KEY: key(31) })).toThrow(/ENCRYPTION_KEY/);
    expect(() => validateEnv({ ...BASE, ENCRYPTION_KEY: key(33) })).toThrow(/ENCRYPTION_KEY/);
    expect(() => validateEnv({ ...BASE, ENCRYPTION_KEY: 'not base64!' })).toThrow(/ENCRYPTION_KEY/);
    expect(validateEnv({ ...BASE, ENCRYPTION_KEY: key(32) }).ENCRYPTION_KEY).toBe(key(32));
  });

  it('coerces SMTP_PORT and SMTP_SECURE, and treats blank SMTP credentials as unset', () => {
    const env = validateEnv({ ...BASE, SMTP_USER: '', SMTP_PASSWORD: '' });
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.SMTP_PASSWORD).toBeUndefined();
    expect(validateEnv({ ...BASE, SMTP_SECURE: 'true' }).SMTP_SECURE).toBe(true);
    expect(validateEnv({ ...BASE, SMTP_SECURE: 'false' }).SMTP_SECURE).toBe(false);
    expect(validateEnv({ ...BASE, SMTP_SECURE: '' }).SMTP_SECURE).toBe(false);
    expect(() => validateEnv({ ...BASE, SMTP_SECURE: 'yes' })).toThrow(/SMTP_SECURE/);
    expect(validateEnv({ ...BASE, SMTP_USER: 'u', SMTP_PASSWORD: 'p' }).SMTP_USER).toBe('u');
  });

  it('validates MAIL_FROM as an address or a named address', () => {
    expect(validateEnv({ ...BASE, MAIL_FROM: 'a@b.c' }).MAIL_FROM).toBe('a@b.c');
    expect(validateEnv({ ...BASE, MAIL_FROM: 'Name <a@b.c>' }).MAIL_FROM).toBe('Name <a@b.c>');
    expect(() => validateEnv({ ...BASE, MAIL_FROM: 'nope' })).toThrow(/MAIL_FROM/);
  });

  it('treats the initial admin variables as optional and validates them when set', () => {
    const env = validateEnv({ ...BASE, INITIAL_ADMIN_EMAIL: '', INITIAL_ADMIN_PASSWORD: '' });
    expect(env.INITIAL_ADMIN_EMAIL).toBeUndefined();
    expect(env.INITIAL_ADMIN_PASSWORD).toBeUndefined();
    expect(() => validateEnv({ ...BASE, INITIAL_ADMIN_EMAIL: 'nope' })).toThrow(
      /INITIAL_ADMIN_EMAIL/,
    );
    expect(() => validateEnv({ ...BASE, INITIAL_ADMIN_PASSWORD: 'x'.repeat(11) })).toThrow(
      /INITIAL_ADMIN_PASSWORD/,
    );
    expect(() => validateEnv({ ...BASE, INITIAL_ADMIN_PASSWORD: 'x'.repeat(129) })).toThrow(
      /INITIAL_ADMIN_PASSWORD/,
    );
    const ok = validateEnv({
      ...BASE,
      INITIAL_ADMIN_EMAIL: 'admin@offwise.local',
      INITIAL_ADMIN_PASSWORD: 'x'.repeat(12),
    });
    expect(ok.INITIAL_ADMIN_EMAIL).toBe('admin@offwise.local');
  });

  describe('TRUST_PROXY', () => {
    it('defaults to loopback, also when blank', () => {
      expect(validateEnv(BASE).TRUST_PROXY).toEqual(['loopback']);
      expect(validateEnv({ ...BASE, TRUST_PROXY: '' }).TRUST_PROXY).toEqual(['loopback']);
    });

    it('accepts true and false', () => {
      expect(validateEnv({ ...BASE, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
      expect(validateEnv({ ...BASE, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    });

    it('accepts a hop count', () => {
      expect(validateEnv({ ...BASE, TRUST_PROXY: '0' }).TRUST_PROXY).toBe(0);
      expect(validateEnv({ ...BASE, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    });

    it('accepts a comma-separated list of presets, IPs and CIDRs', () => {
      expect(
        validateEnv({
          ...BASE,
          TRUST_PROXY: 'loopback, uniquelocal,10.0.0.1,10.1.0.0/16,fd00::/8,::1,linklocal',
        }).TRUST_PROXY,
      ).toEqual([
        'loopback',
        'uniquelocal',
        '10.0.0.1',
        '10.1.0.0/16',
        'fd00::/8',
        '::1',
        'linklocal',
      ]);
    });

    it('rejects anything else', () => {
      for (const value of [
        'yes',
        '-1',
        '1.5',
        'loopback,,',
        'example.com',
        '10.0.0.0/33',
        '10.0.0.1/x',
      ]) {
        expect(() => validateEnv({ ...BASE, TRUST_PROXY: value }), value).toThrow(/TRUST_PROXY/);
      }
    });
  });

  describe('placeholder secrets from .env.example', () => {
    const EXAMPLE_SESSION_SECRET = 'dev-only-session-secret-change-me-0123456789';
    const EXAMPLE_ENCRYPTION_KEY = 'ndZMmk9iiQkenJrFGsco5APAgWMwGmejXgnikmxKPU8=';

    it('rejects them when NODE_ENV is production', () => {
      const prod = { ...BASE, NODE_ENV: 'production' };
      expect(() => validateEnv({ ...prod, SESSION_SECRET: EXAMPLE_SESSION_SECRET })).toThrow(
        /SESSION_SECRET/,
      );
      expect(() => validateEnv({ ...prod, ENCRYPTION_KEY: EXAMPLE_ENCRYPTION_KEY })).toThrow(
        /ENCRYPTION_KEY/,
      );
    });

    it('allows them outside production', () => {
      for (const NODE_ENV of ['development', 'test']) {
        const env = validateEnv({
          ...BASE,
          NODE_ENV,
          SESSION_SECRET: EXAMPLE_SESSION_SECRET,
          ENCRYPTION_KEY: EXAMPLE_ENCRYPTION_KEY,
        });
        expect(env.SESSION_SECRET).toBe(EXAMPLE_SESSION_SECRET);
      }
    });

    it('matches the values committed in .env.example', () => {
      const example = readFileSync(join(__dirname, '../../.env.example'), 'utf8');
      expect(example).toContain(`SESSION_SECRET=${EXAMPLE_SESSION_SECRET}\n`);
      expect(example).toContain(`ENCRYPTION_KEY=${EXAMPLE_ENCRYPTION_KEY}`);
    });
  });
});

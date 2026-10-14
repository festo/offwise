import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

const DB = 'postgresql://u:p@localhost:5432/x';

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv({ NODE_ENV: 'test', DATABASE_URL: DB });
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('converts PORT from a string', () => {
    expect(validateEnv({ NODE_ENV: 'production', DATABASE_URL: DB, PORT: '8080' }).PORT).toBe(8080);
  });

  it('treats blank optional variables as unset', () => {
    const env = validateEnv({ NODE_ENV: 'test', DATABASE_URL: DB, PORT: '', LOG_LEVEL: '' });
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('drops variables it does not know', () => {
    expect(
      validateEnv({ NODE_ENV: 'test', DATABASE_URL: DB, PATH: '/usr/bin' }),
    ).not.toHaveProperty('PATH');
  });

  it('rejects a missing NODE_ENV with a prefixed message naming the variable', () => {
    expect(() => validateEnv({})).toThrow(/^Invalid environment configuration: .*NODE_ENV/);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', DATABASE_URL: DB, LOG_LEVEL: 'loud' })).toThrow(
      /LOG_LEVEL/,
    );
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', DATABASE_URL: DB, PORT: '70000' })).toThrow(
      /PORT/,
    );
  });

  it('requires DATABASE_URL to be a postgres connection string', () => {
    expect(() => validateEnv({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ NODE_ENV: 'test', DATABASE_URL: 'mysql://x' })).toThrow(
      /DATABASE_URL/,
    );
    expect(validateEnv({ NODE_ENV: 'test', DATABASE_URL: DB }).DATABASE_URL).toBe(DB);
  });
});

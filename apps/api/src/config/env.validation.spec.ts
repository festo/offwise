import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv({ NODE_ENV: 'test' });
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('converts PORT from a string', () => {
    expect(validateEnv({ NODE_ENV: 'production', PORT: '8080' }).PORT).toBe(8080);
  });

  it('drops variables it does not know', () => {
    expect(validateEnv({ NODE_ENV: 'test', PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });

  it('rejects a missing NODE_ENV with a prefixed message naming the variable', () => {
    expect(() => validateEnv({})).toThrow(/^Invalid environment configuration: .*NODE_ENV/);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', PORT: '70000' })).toThrow(/PORT/);
  });
});

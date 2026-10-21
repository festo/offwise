import { isIP } from 'node:net';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@offwise/shared';
import { z } from 'zod';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;

/** A blank value (`PORT=` in .env) means unset, so the default applies. */
const blankAsUnset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

/** The placeholder secrets committed in apps/api/.env.example; never valid in production. */
export const EXAMPLE_SESSION_SECRET = 'dev-only-session-secret-change-me-0123456789';
export const EXAMPLE_ENCRYPTION_KEY = 'ndZMmk9iiQkenJrFGsco5APAgWMwGmejXgnikmxKPU8=';

const TRUST_PROXY_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);

/** An express trust-proxy preset, an IP address or a CIDR range. */
function isTrustedProxyEntry(entry: string): boolean {
  if (TRUST_PROXY_PRESETS.has(entry)) return true;
  const [address, prefix, ...rest] = entry.split('/');
  const version = isIP(address ?? '');
  if (version === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= (version === 4 ? 32 : 128);
}

/**
 * Express `trust proxy`: `true`/`false`, a hop count, or a comma-separated list of presets
 * (`loopback`, `linklocal`, `uniquelocal`), IPs and CIDRs.
 */
const trustProxy = z
  .string()
  .default('loopback')
  .transform((value, ctx): boolean | number | string[] => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^\d+$/.test(value)) return Number(value);
    const entries = value.split(',').map((entry) => entry.trim());
    if (entries.every(isTrustedProxyEntry)) return entries;
    ctx.addIssue({
      code: 'custom',
      message:
        'must be true, false, a hop count, or a comma-separated list of IPs, CIDRs or loopback/linklocal/uniquelocal',
    });
    return z.NEVER;
  });

/** Whole days, 1 to 365. */
const sessionDays = z.coerce.number().int().min(1).max(365);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS),
    PORT: blankAsUnset(z.coerce.number().int().min(1).max(65535).default(3000)),
    LOG_LEVEL: blankAsUnset(z.enum(LOG_LEVELS).default('info')),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\/.+/, 'must be a postgres:// connection string'),
    REDIS_URL: z.string().regex(/^rediss?:\/\/.+/, 'must be a redis:// or rediss:// URL'),
    PUBLIC_URL: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
    SESSION_SECRET: z.string().min(32),
    SESSION_IDLE_TIMEOUT_DAYS: blankAsUnset(sessionDays.default(7)),
    SESSION_MAX_AGE_DAYS: blankAsUnset(sessionDays.default(30)),
    ENCRYPTION_KEY: z
      .string()
      .refine(
        (value) =>
          /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, 'base64').length === 32,
        'must be base64 for exactly 32 bytes',
      ),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    SMTP_USER: blankAsUnset(z.string().optional()),
    SMTP_PASSWORD: blankAsUnset(z.string().optional()),
    SMTP_SECURE: blankAsUnset(
      z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
    ),
    MAIL_FROM: z
      .string()
      .regex(
        /^(?:[^<>]+<[^\s@<>]+@[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+)$/,
        'must be an email address or "Name <address>"',
      ),
    INITIAL_ADMIN_EMAIL: blankAsUnset(z.email().optional()),
    INITIAL_ADMIN_PASSWORD: blankAsUnset(
      z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH).optional(),
    ),
    TRUST_PROXY: blankAsUnset(trustProxy),
  })
  .superRefine((env, ctx) => {
    if (env.SESSION_IDLE_TIMEOUT_DAYS > env.SESSION_MAX_AGE_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_IDLE_TIMEOUT_DAYS'],
        message: 'must not be greater than SESSION_MAX_AGE_DAYS',
      });
    }
    if (env.NODE_ENV !== 'production') return;
    if (env.SESSION_SECRET === EXAMPLE_SESSION_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'must not be the .env.example placeholder in production',
      });
    }
    if (env.ENCRYPTION_KEY === EXAMPLE_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENCRYPTION_KEY'],
        message: 'must not be the .env.example placeholder in production',
      });
    }
  });

export type EnvironmentVariables = z.infer<typeof envSchema>;
export type LogLevel = EnvironmentVariables['LOG_LEVEL'];

/** Validates and normalises process.env-like input; unknown variables are dropped. */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

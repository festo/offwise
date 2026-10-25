# Module 1: Identity & Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email and password sign-in with server-side Redis sessions, password reset by email, admin user management, first-admin bootstrap, settings and audit foundations, and a mobile-first private-page shell in the web app.

**Architecture:** The API adds infrastructure modules (`redis/`, `audit/`, `settings/`, `mail/`) and two domain modules (`modules/users/`, `modules/auth/`). Sessions, throttle counters and reset tokens live in Redis (ADR 0002); users, settings and audit events live in PostgreSQL. Three global guards (CSRF, auth, admin) protect every route. The web app gains a session composable, router guards, an auth layout, an app layout with an off-canvas sidebar on phones, auth pages and admin user pages. Spec: `docs/specs/2026-10-14-identity-and-login-design.md`.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 17, Redis 8 (`ioredis` 6), `@node-rs/argon2` 2, `cookie-parser`, `nodemailer`, Mailpit, Vitest 3, supertest; Vue 3.5, vue-router 4, vue-i18n 11, shadcn-vue (Reka UI), Tailwind 4, Storybook 9.

## Global Constraints

- Branch `feat/identity-and-login`. Never commit to `main`.
- ADR 0004: implementers never stage, unstage or commit. **Execution override for this module (requested by the maintainer on 2026-10-14):** the whole module is implemented in one pass and reviewed once at the end; there is no review stop between tasks. The final state is handed over unstaged.
- Every workspace keeps `lint`, `typecheck`, `test`, `format` green; api `test:e2e` green; web `build-storybook` green.
- Add dependencies to the workspace that uses them (`pnpm --filter <pkg> add <dep>`).
- Tests use Vitest; test files import `describe`/`it`/`expect`/`vi` from `vitest`.
- Table and column names are snake_case via `SnakeNamingStrategy`; explicit names must be snake_case. Migrations come from the TypeORM CLI (`.claude/skills/typeorm-migrations/SKILL.md`); hand-written SQL (expression index, trigger) is added to the generated file.
- Register every entity in `apps/api/src/database/entities.ts`.
- Request DTOs use class-validator; env uses zod. Contracts consumed by the web app live in `@offwise/shared`.
- Roles: `employee | manager | admin | auditor`. Only `admin` has an effect in this module.
- Password policy: 12 to 128 characters, no composition rules. Argon2id with `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`.
- Sessions: 7-day sliding idle timeout, 30-day absolute cap, refreshed at most once per 60 s. Cookie `offwise_session`: httpOnly, `SameSite=Lax`, `Secure` unless `NODE_ENV=development`, `Path=/api`, signed with `SESSION_SECRET`, `Max-Age` 30 days.
- Throttling: 5 failed logins per email per 15 min; 30 login attempts per IP per 15 min; 3 reset requests per email per hour.
- Reset tokens: 1 hour (24 hours for the bootstrap link), single use, link `${PUBLIC_URL}/reset-password#token=<token>`.
- Session ids and reset tokens: 32 random bytes, base64url; Redis stores only SHA-256 hex hashes.
- CSRF on POST/PUT/PATCH/DELETE: `X-Requested-With: offwise` required; `Sec-Fetch-Site`, if present, must be `same-origin`; if absent, `Origin` must equal the origin of `PUBLIC_URL`; neither header → 403.
- Locale: canonical BCP 47 (`Intl.getCanonicalLocales`). Company default locale `en-GB`; company default time zone `UTC` (until module 4).
- Closing a user = soft delete (`deleted_at`). Email unique on `lower(email)` among non-deleted users. No reopen.
- Audit events are append-only (DB trigger rejects UPDATE and DELETE).
- Web: mobile first (min width 360 px, 44 px touch targets, 16 px inputs, no hover-only UI). Every string through `t()`. Every component in `src/components/` and `src/features/*/components/` has a sibling story.

## Agent routing

Task 1 (compose, devcontainer, docs) → `general-purpose`. Tasks 2–9 → `backend`. Tasks 10–13 → `frontend`. Task 14 → coordinating session.

## File structure

```
docker-compose.yml                         + redis, mailpit
.devcontainer/compose.yml, devcontainer.json, post-create.sh   + redis

packages/shared/src/
  auth.ts        Role, ROLES, CurrentUser, LoginRequest, PasswordResetRequest, PasswordResetConfirmRequest,
                 PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, CSRF_HEADER, CSRF_HEADER_VALUE
  users.ts       UserDto, UserListQuery, Page<T>, CreateUserRequest, UpdateUserRequest
  errors.ts      ApiErrorBody

apps/api/src/
  config/env.validation.ts                 + Module 1 variables
  redis/redis.module.ts, redis.constants.ts                  REDIS client provider (global)
  audit/audit-event.entity.ts, audit.service.ts, audit.module.ts, diff.ts
  settings/setting.entity.ts, settings.service.ts, settings.module.ts,
           settings-namespace.ts, secret-box.ts, company.settings.ts, company-defaults.step.ts
  mail/mail.module.ts, mail.service.ts, templates/password-reset.ts
  modules/users/entities/user.entity.ts, users.service.ts, users.controller.ts, users.module.ts,
               dto/*.ts, validation/locale.ts, validation/time-zone.ts, user.mapper.ts
  modules/auth/password.service.ts, session.service.ts, throttle.service.ts, reset-token.service.ts,
              auth.service.ts, password-reset.service.ts, auth.controller.ts, session-cookie.ts,
              decorators.ts, throttled.exception.ts, guards/{csrf,auth,admin}.guard.ts,
              auth-core.module.ts, auth.module.ts
  install/initial-admin.service.ts
  migrations/<ts>-CreateIdentity.ts
apps/api/test/  utils/redis.ts, utils/mailpit.ts, utils/http.ts, utils/factories.ts, *.e2e-spec.ts

apps/web/src/
  lib/api.ts                               + apiPost/apiPatch/apiDelete, CSRF header, error bodies
  features/auth/composables/useSession.ts, components/{LoginForm,ForgotPasswordForm,ResetPasswordForm}.vue
  features/users/composables/useUsers.ts, components/{UserTable,UserForm,CloseUserDialog}.vue
  components/{AppLayout,AuthLayout,UserMenu}.vue
  pages/{LoginPage,ForgotPasswordPage,ResetPasswordPage,HomePage,UsersPage,UserNewPage,UserEditPage}.vue
  router/index.ts, router/guards.ts, i18n/index.ts (+ setLocaleFromTag), i18n/locales/en.json
```

---

### Task 1: Redis and Mailpit in the dev environment

**Files:**
- Modify: `docker-compose.yml`, `.devcontainer/compose.yml`, `.devcontainer/devcontainer.json`, `.devcontainer/post-create.sh`
- Modify: `docs/decisions/0007-devcontainer-for-development.md`, `CLAUDE.md`, `apps/api/CLAUDE.md`, `.claude/skills/typeorm-migrations/SKILL.md` (compose command)

- [ ] **Step 1:** Root `docker-compose.yml` gains:

```yaml
  redis:
    image: redis:8-alpine
    command: ['redis-server', '--appendonly', 'yes', '--appendfsync', 'everysec']
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 10

  mailpit:
    image: axllent/mailpit:v1.27
    ports:
      - '1025:1025'
      - '8025:8025'
```

and `redis-data: {}` under `volumes`.

- [ ] **Step 2:** `.devcontainer/compose.yml`: `redis` gets `ports: !reset []` and `network_mode: service:db`; `mailpit` keeps `network_mode: service:db` and gets `ports: !reset []`; `workspace.depends_on` adds `redis: { condition: service_healthy }`. `devcontainer.json` `runServices` adds `redis`. `post-create.sh` waits for `6379` like it waits for `5432`.
- [ ] **Step 3:** Docs: ADR 0007 lists `redis` (AOF, data volume) next to `db` and `mailpit` and gets `**Updated:** 2026-10-14`; root and api `CLAUDE.md` replace `docker compose up -d db` with `docker compose up -d db redis mailpit` where e2e or dev needs them; the migrations skill keeps `db` only (migrations need only Postgres).
- [ ] **Step 4:** Verify YAML parses: `node -e "require('yaml')"` is not available, so run `pnpm dlx yaml-lint docker-compose.yml .devcontainer/compose.yml` or review by eye; `pnpm -r format` must not change them.

### Task 2: Env, Redis client and e2e harness

**Files:**
- Modify: `apps/api/src/config/env.validation.ts`, `env.validation.spec.ts`, `apps/api/.env.example`, `apps/api/test/test-env.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app.setup.ts`
- Create: `apps/api/src/redis/redis.constants.ts`, `apps/api/src/redis/redis.module.ts`, `apps/api/test/utils/redis.ts`, `apps/api/test/redis.e2e-spec.ts`

**Interfaces:**
- Produces: `EnvironmentVariables` gains `REDIS_URL`, `PUBLIC_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `SMTP_HOST`, `SMTP_PORT: number`, `SMTP_USER?`, `SMTP_PASSWORD?`, `SMTP_SECURE: boolean`, `MAIL_FROM`, `INITIAL_ADMIN_EMAIL?`, `INITIAL_ADMIN_PASSWORD?`.
- `REDIS = Symbol('REDIS')` injection token; `RedisModule` (global) provides an `ioredis` `Redis` client from `REDIS_URL`, quits it on module destroy.
- Test helpers: `TEST_REDIS_URL` (default `redis://localhost:6379/1`, override `E2E_REDIS_URL`), `flushTestRedis(): Promise<void>` (refuses database 0), `TEST_PUBLIC_URL = 'http://localhost:5173'`.

- [ ] **Step 1: Failing env tests.** Add a `BASE` object with every required variable (`NODE_ENV`, `DATABASE_URL`, `REDIS_URL: 'redis://localhost:6379/0'`, `PUBLIC_URL: 'http://localhost:5173'`, `SESSION_SECRET: 'x'.repeat(32)`, `ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64')`, `SMTP_HOST: 'localhost'`, `SMTP_PORT: '1025'`, `MAIL_FROM: 'offwise <noreply@offwise.local>'`) and use it in the existing tests. New cases:
  - `REDIS_URL` must start with `redis://` or `rediss://`.
  - `PUBLIC_URL` must be an absolute http(s) URL; a trailing slash is removed.
  - `SESSION_SECRET` shorter than 32 characters is rejected.
  - `ENCRYPTION_KEY` must be base64 decoding to exactly 32 bytes (31 and 33 bytes rejected).
  - `SMTP_PORT` coerces to a number; `SMTP_SECURE` accepts `true`/`false` strings, default `false`; blank `SMTP_USER`/`SMTP_PASSWORD` are unset.
  - `MAIL_FROM` accepts `Name <a@b.c>` and `a@b.c`, rejects `nope`.
  - `INITIAL_ADMIN_EMAIL` optional, must be an email when set; `INITIAL_ADMIN_PASSWORD` optional, 12–128 characters when set.
- [ ] **Step 2:** Run `pnpm --filter @offwise/api test` → new cases FAIL.
- [ ] **Step 3: Implement the schema.** Use `blankAsUnset` for optional values; `SMTP_SECURE: blankAsUnset(z.enum(['true','false']).default('false').transform(v => v === 'true'))`; `ENCRYPTION_KEY: z.string().refine(v => Buffer.from(v, 'base64').length === 32 && /^[A-Za-z0-9+/]+={0,2}$/.test(v), 'must be base64 for exactly 32 bytes')`; `MAIL_FROM` validated with `/^(?:[^<>]+<[^\s@<>]+@[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+)$/`; `PUBLIC_URL: z.url({ protocol: /^https?$/ }).transform(u => u.replace(/\/+$/, ''))`.
- [ ] **Step 4:** Tests PASS. Update `.env.example` with the dev values from the spec (Mailpit `localhost:1025`, `redis://localhost:6379/0`, a placeholder 32-char `SESSION_SECRET` with a comment to change it, an `ENCRYPTION_KEY` generated by `openssl rand -base64 32`, `INITIAL_ADMIN_EMAIL=admin@offwise.local`, `INITIAL_ADMIN_PASSWORD=offwise-admin-dev`). Also append the new variables to the developer's existing `apps/api/.env` if it exists (it is gitignored).
- [ ] **Step 5: Redis module.**

```ts
// src/redis/redis.constants.ts
export const REDIS = Symbol('REDIS');

// src/redis/redis.module.ts
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new Redis(config.get('REDIS_URL', { infer: true }), { maxRetriesPerRequest: 3 }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
```

Import it in `AppModule`. `test-env.ts` sets `REDIS_URL = TEST_REDIS_URL`, `PUBLIC_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `MAIL_FROM`, and deletes `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD`. `assertTestRedis(url)` rejects database 0 (path `''`, `/` or `/0`).
- [ ] **Step 6:** `configureApp` sets `app.set('trust proxy', 'loopback')` (via `app.getHttpAdapter().getInstance()`), so `req.ip` is the client address behind a local reverse proxy.
- [ ] **Step 7:** `test/redis.e2e-spec.ts`: the app's `REDIS` client can `SET`/`GET` in the test database; `flushTestRedis()` empties it. Run `pnpm --filter @offwise/api test:e2e` → PASS.

### Task 3: Identity schema (users, settings, audit events)

**Files:**
- Create: `apps/api/src/modules/users/entities/user.entity.ts`, `apps/api/src/settings/setting.entity.ts`, `apps/api/src/audit/audit-event.entity.ts`, `apps/api/src/migrations/<ts>-CreateIdentity.ts` (CLI), `apps/api/test/identity-schema.e2e-spec.ts`
- Modify: `apps/api/src/database/entities.ts`
- Create: `packages/shared/src/auth.ts` (only `ROLES`, `Role` here; the rest in Task 6), `packages/shared/src/index.ts`

**Interfaces:**
- `ROLES = ['employee', 'manager', 'admin', 'auditor'] as const; type Role = (typeof ROLES)[number]` in `@offwise/shared`.
- `User { id: string; email: string; name: string; passwordHash: string | null; role: Role; locale: string | null; timeZone: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null }`
- `Setting { namespace: string; value: Record<string, unknown>; updatedAt: Date; updatedByUserId: string | null }`
- `AuditEvent { id: string; occurredAt: Date; actorUserId: string | null; action: AuditAction; entityType: AuditEntityType | null; entityId: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null }`

- [ ] **Step 1: Failing e2e.** `test/identity-schema.e2e-spec.ts` (DataSource from `buildDataSourceOptions(TEST_DATABASE_URL)`, `resetDatabase` before each):
  - two non-deleted users with `A@x.io` and `a@x.io` → second insert fails with code `23505`;
  - after soft-deleting the first, inserting `a@x.io` succeeds;
  - `UPDATE audit_events SET action = 'x'` and `DELETE FROM audit_events` both throw `audit_events is append-only`;
  - `TRUNCATE audit_events` still succeeds.
- [ ] **Step 2: Entities.**

```ts
@Entity({ name: 'users' })
@Index('UQ_users_email_active', { synchronize: false }) // lower(email) WHERE deleted_at IS NULL, created in the migration
export class User {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_users' }) id!: string;
  @Column({ type: 'varchar', length: 254 }) email!: string;
  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ type: 'text', nullable: true }) passwordHash!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'employee' }) role!: Role;
  @Column({ type: 'varchar', length: 35, nullable: true }) locale!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) timeZone!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt!: Date | null;
}
```

`Setting`: `@Entity({ name: 'settings' })`, `@PrimaryColumn({ type: 'varchar', length: 100, primaryKeyConstraintName: 'PK_settings' }) namespace`, `@Column({ type: 'jsonb' }) value`, `@UpdateDateColumn({ type: 'timestamptz' }) updatedAt`, `@Column({ type: 'uuid', nullable: true }) updatedByUserId`, `@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'updated_by_user_id', foreignKeyConstraintName: 'FK_settings_updated_by_user' }) updatedBy`.

`AuditEvent`: `@Entity({ name: 'audit_events' })`, uuid PK `PK_audit_events`, `@CreateDateColumn({ type: 'timestamptz' }) occurredAt` with `@Index('IDX_audit_events_occurred_at')`, `actorUserId` uuid nullable + `@ManyToOne(() => User)` join column `actor_user_id` (FK `FK_audit_events_actor_user`, `onDelete: 'NO ACTION'`) with `@Index('IDX_audit_events_actor_user_id')`, `action` varchar(100), `entityType` varchar(50) nullable, `entityId` varchar(100) nullable, class-level `@Index('IDX_audit_events_entity', ['entityType', 'entityId'])`, `before`/`after` jsonb nullable.

Register all three in `entities.ts`.
- [ ] **Step 3: Migration.** `migration:run`, then `migration:generate CreateIdentity`, then `format`. Append to `up()`:

```sql
CREATE UNIQUE INDEX "UQ_users_email_active" ON "users" (lower("email")) WHERE "deleted_at" IS NULL;
CREATE FUNCTION audit_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_events is append-only'; END $$;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
```

and prepend the matching drops to `down()` (`DROP TRIGGER`, `DROP FUNCTION`, `DROP INDEX`). Run `migration:run`, the drift check (must report no changes), then `test:e2e` (naming guard and the new spec) → PASS.

### Task 4: Audit and settings services, `company.defaults` step

**Files:**
- Create: `apps/api/src/audit/diff.ts`, `diff.spec.ts`, `audit.service.ts`, `audit.module.ts`
- Create: `apps/api/src/modules/users/validation/locale.ts`, `locale.spec.ts`, `validation/time-zone.ts`, `time-zone.spec.ts`
- Create: `apps/api/src/settings/secret-box.ts`, `secret-box.spec.ts`, `settings-namespace.ts`, `company.settings.ts`, `settings.service.ts`, `settings.module.ts`, `company-defaults.step.ts`, `company-defaults.step.spec.ts`
- Modify: `apps/api/src/install/install-steps.registry.ts`, `apps/api/src/app.module.ts`, `apps/api/test/install-steps.e2e-spec.ts`
- Test: `apps/api/test/settings.e2e-spec.ts`

**Interfaces:**
- `diffFields(before: Record<string, unknown>, after: Record<string, unknown>, redact?: readonly string[]): { before: Record<string, unknown>; after: Record<string, unknown> } | null` — only keys whose values differ (deep-equal via `JSON.stringify` of each value); redacted keys become `'[redacted]'`; `null` when nothing changed.
- `src/audit/audit-actions.ts`: `AUDIT_ENTITY_TYPES`, `AUDIT_ACTIONS` (action → entity type, `as const satisfies Record<string, AuditEntityType>`), `type AuditAction = keyof typeof AUDIT_ACTIONS`. `record` sets `entityType` from `AUDIT_ACTIONS[action]`.
- `interface AuditEventInput { actorUserId: string | null; action: AuditAction; entityId?: string; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }`
- `AuditService.record(manager: EntityManager, event: AuditEventInput): Promise<void>` (the only method). `AuditModule` is `@Global()`.
- `canonicalLocale(value: string): string | null`; `@IsBcp47Locale()` class-validator decorator; `canonicalTimeZone(value: string): string | null` (via `new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone`); `@IsIanaTimeZone()`. Both are used with `@Transform` to canonicalise before validation.
- `createSecretBox(base64Key: string): { encrypt(plain: string): string; decrypt(sealed: string): string }` — AES-256-GCM, 12-byte random IV, output `v1.<iv b64url>.<tag b64url>.<ciphertext b64url>`; `decrypt` throws on tampering.
- `interface SettingsNamespace<T extends object> { name: string; dto: new () => T; defaults: T; secretFields: readonly (keyof T & string)[] }`
- `class CompanySettingsDto { @IsString() @Length(1, 200) name!: string; @IsBcp47Locale() locale!: string }` (decorator from `modules/users/validation/locale.ts`, see below), `companySettings: SettingsNamespace<CompanySettingsDto> = { name: 'company', dto: CompanySettingsDto, defaults: { name: 'offwise', locale: 'en-GB' }, secretFields: [] }`, `COMPANY_DEFAULT_TIME_ZONE = 'UTC'`.
- `SettingsService.get<T>(ns): Promise<T>` (stored over defaults, secret fields decrypted, cached per namespace); `SettingsService.set<T>(ns, value: T, actor: { userId: string | null }): Promise<void>` (validates with class-validator, throws `BadRequestException` with messages; encrypts secret fields; upserts; audits `settings.updated` (entity type `settings`) with `entityId: ns.name`, diff with secret fields redacted, in one transaction; then clears the cache entry).
- `companyDefaultsStep: InstallStep = { name: 'company.defaults', run: manager => manager.createQueryBuilder().insert().into(Setting).values({ namespace: 'company', value: { ...companySettings.defaults } }).orIgnore().execute() }`.

- [ ] **Step 1: Failing unit tests.** `locale.spec.ts`: `en-gb` → `en-GB`, `EN` → `en`, `hu-HU` → `hu-HU`, `en_GB` → null, `''` → null, `x` → null. `time-zone.spec.ts`: `Europe/Budapest` ok, `utc` → `UTC`, `Mars/Base` → null. `diff.spec.ts`: unchanged → `null`; changed keys only; added and removed keys; nested objects compared by value; redaction. `secret-box.spec.ts`: round trip; two encryptions differ; tampered ciphertext and wrong key throw; output starts with `v1.`. `company-defaults.step.spec.ts`: the step name is `company.defaults` and the defaults are `{ name: 'offwise', locale: 'en-GB' }`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Failing e2e** `test/settings.e2e-spec.ts` with a test-only namespace `{ name: 'test.sample', dto: SampleDto { @IsString() title; @IsString() @IsOptional() apiKey? }, defaults: { title: 'Default' }, secretFields: ['apiKey'] }`:
  - `get` with no row returns defaults;
  - `set` then `get` returns the new value; the raw row's `apiKey` starts with `v1.` (encrypted at rest); `get` returns the decrypted value;
  - `set` with `{ title: 5 }` throws `BadRequestException` and writes nothing;
  - one `settings.updated` audit event exists with `apiKey: '[redacted]'` in `after`;
  - a second `SettingsService` instance (new app) reads the stored value (cache is per process).
- [ ] **Step 4:** Implement → PASS. Register `companyDefaultsStep` in `install-steps.registry.ts`. Update `install-steps.e2e-spec.ts`'s CLI test: first run prints `Applied install steps: company.defaults` and creates the `company` row; second run prints `No pending install steps.`

### Task 5: Sessions, throttling and reset tokens (Redis)

**Files:**
- Create: `apps/api/src/modules/auth/tokens.ts`, `session.service.ts`, `session-ttl.ts`, `session-ttl.spec.ts`, `throttle.service.ts`, `reset-token.service.ts`, `auth-core.module.ts`, `password.service.ts`, `password.service.spec.ts`
- Test: `apps/api/test/session.e2e-spec.ts`, `apps/api/test/throttle.e2e-spec.ts`, `apps/api/test/reset-token.e2e-spec.ts`

**Interfaces:**
- `newToken(): string` (32 random bytes, base64url); `hashToken(token: string): string` (SHA-256 hex).
- `sessionLifetime(env)` in `src/config/session-lifetime.ts` → `{ idleMs, absoluteMs }` from `SESSION_IDLE_TIMEOUT_DAYS` / `SESSION_MAX_AGE_DAYS`; `SessionService.lifetime` holds it. Touch interval `60_000` ms is a constant in `session.service.ts`. `sessionTtlMs(createdAt, now, lifetime): number` = `min(lifetime.idleMs, createdAt + lifetime.absoluteMs - now)` (≤ 0 means expired).
- `interface SessionData { userId: string; createdAt: number; lastSeenAt: number }`
- `SessionService.create(userId): Promise<string>` (returns the raw id; `HSET session:{hash}`, `PEXPIRE`, `SADD user-sessions:{userId} {hash}`, `PEXPIRE` the set to 30 days); `get(id): Promise<SessionData | null>` (returns null and deletes when past the absolute cap; refreshes `lastSeenAt` and TTL when `now - lastSeenAt ≥ 60 s`); `destroy(id): Promise<void>` (also `SREM`); `destroyAllForUser(userId): Promise<void>` (deletes every member key and the set).
- `ThrottleService.hit(key, limit, windowSec): Promise<{ allowed: boolean; retryAfterSec: number }>` (`INCR`; on 1 set `EXPIRE`; `allowed = count <= limit`; `retryAfterSec` from `TTL`); `isBlocked(key, limit): Promise<{ blocked: boolean; retryAfterSec: number }>` (reads without incrementing; blocked when `count >= limit`); `clear(key): Promise<void>`.
- Key helpers in `throttle.service.ts`: `loginEmailKey(email)` → `throttle:login:email:{email.toLowerCase()}`, `loginIpKey(ip)`, `resetEmailKey(email)`; constants `LOGIN_EMAIL_LIMIT = 5`, `LOGIN_IP_LIMIT = 30`, `LOGIN_WINDOW_SEC = 900`, `RESET_EMAIL_LIMIT = 3`, `RESET_WINDOW_SEC = 3600`.
- `ResetTokenService.create(userId, ttlSec = 3600): Promise<string>` (`SET password-reset:{hash} userId EX ttl`, `SADD user-resets:{userId} {hash}` with `EXPIRE` = max of ttl); `consume(token): Promise<string | null>` (`GETDEL`, returns userId); `revokeAllForUser(userId): Promise<void>`. `RESET_TTL_SEC = 3600`, `BOOTSTRAP_RESET_TTL_SEC = 86400`.
- `PasswordService.hash(plain): Promise<string>`; `verify(hash: string | null, plain): Promise<boolean>` (with a null hash verifies against a lazily computed dummy hash and returns false); `needsRehash(hash): boolean` (via `parseOptions` from `@node-rs/argon2`, compares `memoryCost`, `timeCost`, `parallelism` to `ARGON2_OPTIONS`); `ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }` (algorithm left at the library default, Argon2id; do not import the `Algorithm` const enum — SWC cannot inline it).
- `AuthCoreModule` provides and exports `PasswordService`, `SessionService`, `ThrottleService`, `ResetTokenService`.

- [ ] **Step 1:** `pnpm --filter @offwise/api add ioredis@^6 @node-rs/argon2@^2` (ioredis was needed in Task 2; add it there if not yet).
- [ ] **Step 2: Failing unit tests.** `session-ttl.spec.ts`: new session → 7 days; 29 days old → 1 day; 30 days old → 0; 31 days → negative. `password.service.spec.ts`: hash starts with `$argon2id$`; verify true/false; `verify(null, 'x')` false; `needsRehash` false for a fresh hash and true for a hash made with `timeCost: 1`.
- [ ] **Step 3: Failing e2e (real Redis, `flushTestRedis` before each)**:
  - sessions: create → get returns userId; destroy → null; destroyAllForUser removes all sessions of that user and not another user's; TTL is ≤ 7 days; with `vi.spyOn(Date, 'now')` 31 days ahead `get` returns null; `lastSeenAt` unchanged within 60 s and refreshed after;
  - throttle: 5 hits allowed, 6th not, `retryAfterSec` in `(0, 900]`; `isBlocked` after 5; `clear` resets;
  - reset tokens: consume returns userId once, then null; `revokeAllForUser` invalidates outstanding tokens; Redis holds no raw token (`KEYS *` contains only hashes).
- [ ] **Step 4:** Implement → PASS.

### Task 6: Guards, login, logout and me

**Files:**
- Modify: `packages/shared/src/auth.ts`, create `packages/shared/src/errors.ts`, export both from `index.ts`
- Create: `apps/api/src/modules/auth/decorators.ts`, `session-cookie.ts`, `throttled.exception.ts`, `throttled-exception.filter.ts`, `guards/csrf.guard.ts`, `guards/csrf.guard.spec.ts`, `guards/auth.guard.ts`, `guards/admin.guard.ts`, `auth.service.ts`, `auth.controller.ts`, `dto/login.dto.ts`, `auth.module.ts`, `current-user.mapper.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/app.setup.ts` (cookie-parser, filter), `apps/api/src/health/health.controller.ts` (`@Public()`), `apps/api/test/utils/create-test-app.ts`
- Create: `apps/api/test/utils/http.ts`, `apps/api/test/utils/factories.ts`, `apps/api/test/auth.e2e-spec.ts`, `apps/api/test/csrf.e2e-spec.ts`

**Interfaces:**
- Shared: `CSRF_HEADER = 'X-Requested-With'`, `CSRF_HEADER_VALUE = 'offwise'`, `PASSWORD_MIN_LENGTH = 12`, `PASSWORD_MAX_LENGTH = 128`; `interface CurrentUser { id: string; name: string; email: string; role: Role; locale: string | null; timeZone: string | null; effectiveLocale: string; effectiveTimeZone: string }`; `LoginRequest { email: string; password: string }`; `PasswordResetRequest { email: string }`; `PasswordResetConfirmRequest { token: string; password: string }`; `interface ApiErrorBody { statusCode: number; message: string | string[]; error?: string; field?: string; rule?: string; retryAfter?: number }`.
- `@Public()`, `@AdminOnly()` (metadata keys `IS_PUBLIC`, `IS_ADMIN_ONLY`); `@AuthUser()` param decorator returning `req.user: User`; `AuthenticatedRequest = Request & { user: User; sessionId: string }`.
- `SESSION_COOKIE = 'offwise_session'`; `sessionCookieOptions(nodeEnv, maxAgeMs): CookieOptions` = `{ httpOnly: true, sameSite: 'lax', secure: nodeEnv !== 'development', path: '/api', signed: true, maxAge: maxAgeMs }` (the controller passes `SessionService.lifetime.absoluteMs`).
- `ThrottledException(retryAfterSec)` → 429 with body `{ statusCode: 429, message: 'Too many attempts. Try again later.', retryAfter }`; `ThrottledExceptionFilter` sets the `Retry-After` header.
- `AuthService.login(email, password, ip): Promise<{ user: User; sessionId: string }>` (flow in spec; throws `UnauthorizedException('Invalid email or password')` or `ThrottledException`); `logout(sessionId, user)`; `toCurrentUser(user): Promise<CurrentUser>` (uses `SettingsService.get(companySettings)` and `COMPANY_DEFAULT_TIME_ZONE`).
- Guards registered in `AuthModule` as `APP_GUARD` in this order: `CsrfGuard`, `AuthGuard`, `AdminGuard`.

- [ ] **Step 1:** `pnpm --filter @offwise/api add cookie-parser` and `-D @types/cookie-parser`. `configureApp` adds `app.use(cookieParser(SESSION_SECRET))` (read from `app.get(ConfigService)`) and `app.useGlobalFilters(new ThrottledExceptionFilter())`.
- [ ] **Step 2: Failing CSRF unit tests** (`csrf.guard.spec.ts`, guard built with `PUBLIC_URL=https://leave.example.com`, `ExecutionContext` stubbed): GET passes without headers; POST without `X-Requested-With` → 403; with header and `Sec-Fetch-Site: same-origin` → pass; `cross-site` and `same-site` → 403; no `Sec-Fetch-Site` and `Origin: https://leave.example.com` → pass; foreign `Origin` → 403; neither → 403; `Origin: null` → 403. Header value compared case-sensitively against `offwise`.
- [ ] **Step 3:** Implement `CsrfGuard` → PASS.
- [ ] **Step 4: Test helpers.** `test/utils/http.ts`: `api(app)` returns a supertest agent wrapper whose `post/patch/delete` set `X-Requested-With: offwise` and `Origin: TEST_PUBLIC_URL`; `signIn(app, email, password): Promise<{ agent: request.Agent; cookie: string }>` using `request.agent`. `test/utils/factories.ts`: `createUser(dataSource, overrides?: Partial<User> & { password?: string }): Promise<User>` (hashes with `PasswordService`, defaults `name: 'Test User'`, unique email `user-<n>@example.test`, role `employee`). `createTestApp` unchanged apart from what `configureApp` adds.
- [ ] **Step 5: Failing e2e** `auth.e2e-spec.ts` (`resetDatabase` + `flushTestRedis` before each):
  - login with correct credentials → 200, `CurrentUser` body with `effectiveLocale: 'en-GB'`, `effectiveTimeZone: 'UTC'`; `Set-Cookie` contains `offwise_session=`, `HttpOnly`, `Path=/api`, `SameSite=Lax`, `Max-Age=2592000`;
  - `GET /api/auth/me` with the cookie → 200; without → 401;
  - wrong password, unknown email, user without password, closed user → 401 with the same message;
  - 5 wrong passwords then the right one → 429 with `Retry-After`;
  - logout → 204, cookie cleared, `me` → 401;
  - audit has `auth.login_succeeded`, `auth.login_failed` (with `after.email`), `auth.logout`;
  - a user whose hash used `timeCost: 1` has a rehashed `password_hash` after login;
  - an `employee` gets 403 on an `@AdminOnly()` route (use `GET /api/users` once Task 8 exists; until then a test-only controller registered in the test module).
- [ ] **Step 6:** `csrf.e2e-spec.ts`: `POST /api/auth/login` without the header → 403; with header but `Origin: https://evil.example` → 403; with header and `Sec-Fetch-Site: cross-site` → 403; correct headers → not 403.
- [ ] **Step 7:** Implement guards, service, controller (`POST /auth/login` 200, `POST /auth/logout` 204, `GET /auth/me`), `@Public()` on login and health. `AuthGuard`: public routes pass (but still attach the user if a valid session cookie exists — not needed now, so simply pass); otherwise read `req.signedCookies[SESSION_COOKIE]`, `SessionService.get`, load `User` with `findOneBy({ id })` (soft-deleted excluded), attach, else clear the cookie and throw 401. Run → PASS.

### Task 7: Password reset and mail

**Files:**
- Create: `apps/api/src/mail/mail.module.ts`, `mail.service.ts`, `templates/password-reset.ts`, `templates/password-reset.spec.ts`
- Create: `apps/api/src/modules/auth/password-reset.service.ts`, `dto/password-reset.dto.ts`, `dto/password-reset-confirm.dto.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`, `auth.module.ts`
- Create: `apps/api/test/utils/mailpit.ts`, `apps/api/test/password-reset.e2e-spec.ts`

**Interfaces:**
- `MailService.send({ to, subject, text, html }): Promise<void>` (nodemailer transport from env; `auth` only when `SMTP_USER` is set).
- `passwordResetEmail({ name, link }): { subject: string; text: string; html: string }` — subject `Reset your offwise password`; text and HTML contain the link and say it expires in 1 hour; the name is HTML-escaped in the HTML part.
- `PasswordResetService.request(email): Promise<void>` (throttle `hit` on `resetEmailKey` → `ThrottledException` when not allowed; then `setImmediate` a background job that finds the non-deleted user, creates a token, sends the email, audits `auth.password_reset_requested`; errors are logged, never thrown); `confirm(token, password): Promise<void>` (`consume` → `BadRequestException('This reset link is invalid or has expired.')` when null or the user is closed; hash, save, `revokeAllForUser`, `destroyAllForUser`, audit `auth.password_reset_completed`).
- Mailpit helper: `MAILPIT_URL` (default `http://localhost:8025`, override `E2E_MAILPIT_URL`); `clearMailbox()` (`DELETE /api/v1/messages`); `waitForMessageTo(email, timeoutMs = 5000): Promise<{ Subject: string; Text: string; HTML: string }>` (polls `GET /api/v1/search?query=to:"<email>"`, then `GET /api/v1/message/<ID>`); `extractResetToken(text): string` (regex `#token=([A-Za-z0-9_-]+)`).

- [ ] **Step 1:** `pnpm --filter @offwise/api add nodemailer` and `-D @types/nodemailer`.
- [ ] **Step 2: Failing unit tests.** `password-reset.spec.ts`: subject; link in both parts; `<b>` in the name escaped.
- [ ] **Step 3:** Implement → PASS.
- [ ] **Step 4: Failing e2e** (`clearMailbox`, reset DB and Redis before each):
  - request for an existing user → 202; email arrives with a link starting `http://localhost:5173/reset-password#token=`;
  - confirm with that token and a 12-character password → 204; login with the new password works; the session created before the reset is gone (`me` → 401); confirming again → 400;
  - confirm with a 5-character password → 400;
  - request for an unknown email → 202 and no email after 1 s;
  - 4th request within the hour → 429;
  - audit has `auth.password_reset_requested` and `auth.password_reset_completed`.
- [ ] **Step 5:** Implement endpoints `POST /auth/password-reset` (`@Public()`, `@HttpCode(202)`) and `POST /auth/password-reset/confirm` (`@Public()`, `@HttpCode(204)`) → PASS.

### Task 8: Admin user management API

**Files:**
- Modify: `packages/shared/src/users.ts` (create), `index.ts`
- Create: `apps/api/src/modules/users/users.module.ts`, `users.service.ts`, `users.controller.ts`, `user.mapper.ts`, `dto/create-user.dto.ts`, `dto/update-user.dto.ts`, `dto/list-users.query.ts`, `users.service.spec.ts` (pure rules), `last-admin.ts`
- Test: `apps/api/test/users.e2e-spec.ts`

**Interfaces:**
- Shared: `UserDto { id; name; email; role: Role; locale: string | null; timeZone: string | null; hasPassword: boolean; createdAt: string; closedAt: string | null }`; `Page<T> { items: T[]; total: number; page: number; pageSize: number }`; `UserListQuery { search?: string; includeClosed?: boolean; page?: number; pageSize?: number }`; `CreateUserRequest { name; email; role: Role; locale?: string | null; timeZone?: string | null }`; `UpdateUserRequest = Partial<CreateUserRequest>`.
- `UsersService.list(query): Promise<Page<UserDto>>`; `get(id): Promise<UserDto>`; `create(dto, actor: { userId: string }): Promise<UserDto>`; `update(id, dto, actor)`; `close(id, actor): Promise<void>`.
- Conflicts: `ConflictException({ statusCode: 409, message: 'A user with this email already exists.', field: 'email' })` and `ConflictException({ statusCode: 409, message: 'The last active admin cannot be closed or lose the admin role.', rule: 'last-admin' })`.

- [ ] **Step 1: Failing e2e** `users.e2e-spec.ts` (admin signed in via `signIn`):
  - list: sorted by name; `search` matches name and email case-insensitively; closed users hidden unless `includeClosed=true`; pagination (`pageSize=2` → 2 items, `total` correct); `pageSize=101` → 400;
  - create → 201 `UserDto` with `hasPassword: false`; locale `en-gb` stored as `en-GB`; invalid time zone → 400; duplicate email (other case) → 409 with `field: 'email'`; unknown property → 400;
  - get: closed user → 200 with `closedAt`; unknown id → 404; non-uuid id → 400;
  - update: name and role; email to a closed user's email → 200; to an active user's email → 409; demoting the only admin (self) → 409 `rule: 'last-admin'`; demoting one of two admins → 200; editing a closed user → 200;
  - close: 204, user's sessions ended (their agent gets 401), `deleted_at` set; again → 404; closing the last admin → 409; creating a new user with a closed user's email → 201;
  - audit: `user.created`, `user.updated` (changed fields only), `user.role_changed`, `user.closed`, each with the admin as actor;
  - access: employee → 403 on every endpoint; signed out → 401.
- [ ] **Step 2:** Implement. Last-admin check runs inside the write transaction after `SELECT pg_advisory_xact_lock(4242002)`: count non-deleted admins other than the target; if zero and the change removes admin or closes an admin → conflict. Duplicate email check: `lower(email) = lower(:email) AND deleted_at IS NULL AND id <> :id` (skipped when the target is closed); also map Postgres `23505` on `UQ_users_email_active` to the same 409. List uses `withDeleted` when `includeClosed`, `ILIKE` on name and email with `%`, `_` and `\` escaped. Session revocation runs after commit. `ParseUUIDPipe` on `:id`. Controller is `@AdminOnly()` at class level, `@Controller('users')`.
- [ ] **Step 3:** Run → PASS. Replace the test-only admin controller from Task 6 with `GET /api/users`.

### Task 9: First-admin bootstrap in the install command

**Files:**
- Create: `apps/api/src/install/initial-admin.service.ts` (provided by `InstallCliModule`; no module of its own)
- Modify: `apps/api/src/install/install-cli.module.ts`, `apps/api/src/install.ts`
- Test: `apps/api/test/initial-admin.e2e-spec.ts`; modify `apps/api/test/install-steps.e2e-spec.ts`

**Interfaces:**
- `type InitialAdminOutcome = 'skipped-not-configured' | 'skipped-admin-exists' | 'promoted' | 'created-with-password' | 'created-with-link'`.
- `InitialAdminService.run({ email?: string; password?: string; publicUrl: string }): Promise<{ outcome: InitialAdminOutcome; resetLink?: string }>`; runs in one transaction with the advisory lock `4242002`; audits `user.created` or `user.role_changed` with `actorUserId: null`; for `created-with-link` creates a reset token with `BOOTSTRAP_RESET_TTL_SEC` after commit and returns the link.
- `InstallCliModule` imports `RedisModule`, `AuditModule`, `AuthCoreModule`, `UsersCoreModule` and provides `InitialAdminService` (no `AuthModule`: no guards in the CLI).
- `install.ts` after the steps: runs the service with env values and prints `Initial admin: <outcome>`; for `created-with-link`, prints `Set the initial admin password within 24 hours: <link>`.

- [ ] **Step 1: Failing e2e:** not configured → skipped; admin exists → skipped and nothing changes; existing employee with that email → promoted; new email with password → created, can log in through the API; new email without password → link returned, the token in it works with `POST /auth/password-reset/confirm`. CLI: with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in the child env, `install:run` exits 0 and prints `Initial admin: created-with-password`; second run prints `Initial admin: skipped-admin-exists`.
- [ ] **Step 2:** Implement → PASS. Extend `runApiCli` with an optional `env` override.

### Task 10: Web foundations — API client, session, router guards, locale

**Files:**
- Modify: `apps/web/src/lib/api.ts`, `api.spec.ts`, `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/locales/en.json`, `apps/web/src/router/index.ts`, `apps/web/src/main.ts`
- Create: `apps/web/src/features/auth/composables/useSession.ts`, `useSession.spec.ts`, `apps/web/src/router/guards.ts`, `guards.spec.ts`, `apps/web/src/i18n/locale.spec.ts`

**Interfaces:**
- `ApiError { status: number; message: string; body: ApiErrorBody | null; field?: string; rule?: string; retryAfter?: number }`.
- `apiGet<T>(path)`, `apiPost<T>(path, body?)`, `apiPatch<T>(path, body)`, `apiDelete(path)`: all send `Accept: application/json`, `X-Requested-With: offwise`, `credentials: 'same-origin'`; JSON body with `Content-Type: application/json`; 204 returns `undefined`; non-2xx throws `ApiError` built from the JSON body when present (message joined with `\n` when an array). A global `onUnauthorized(handler)` hook is called on any 401 except from `/auth/login` and `/auth/me`.
- `useSession()` returns `{ user: Readonly<Ref<CurrentUser | null>>, loaded: Readonly<Ref<boolean>>, isAdmin: ComputedRef<boolean>, load(): Promise<void>, login(email, password): Promise<void>, logout(): Promise<void>, clear(): void }`; module-level state shared by all callers; `load()` calls `GET /auth/me` once (401 → `user = null`), `login` sets `user` and applies the locale.
- `setLocaleFromTag(tag: string): void` in `i18n/index.ts`: uses the language subtag if it is in `availableLocales`, else `en`; sets `document.documentElement.lang` to the full tag.
- `installGuards(router: Router, session = useSession()): void` — `beforeEach`: `await session.load()` when not loaded; `meta.public` routes pass, but `meta.guestOnly` (login) redirects signed-in users to `/`; protected routes without a user → `{ name: 'login', query: { redirect: to.fullPath } }`; `meta.admin` without admin → `{ name: 'home' }`. `safeRedirect(value: unknown): string` returns the value only if it starts with `/` and not `//`, else `/`.

- [ ] **Step 1: Failing tests.** `api.spec.ts`: header on every method; JSON body and content type on post/patch; 204 → undefined; `ApiError` exposes `field`, `rule`, `retryAfter`; 401 triggers `onUnauthorized` except for `/auth/me` and `/auth/login`. `useSession.spec.ts`: load sets user; 401 → null and `loaded`; load called twice fetches once; login/logout; isAdmin. `guards.spec.ts` (memory history router with stub routes): signed-out → login with redirect; guest-only redirects signed-in; admin route as employee → home; `safeRedirect('//evil.com')` → `/`. `locale.spec.ts`: `hu-HU` → `en` (only `en` available) and `lang="hu-HU"`; `en-GB` → `en`.
- [ ] **Step 2:** Implement → PASS. Routes: `login` (`/login`, public, guestOnly), `forgot-password`, `reset-password` (public), `home` (`/`), `users` (`/admin/users`, admin), `user-new` (`/admin/users/new`, admin), `user-edit` (`/admin/users/:id`, admin). `main.ts` registers `onUnauthorized` → `session.clear()` and `router.push({ name: 'login', query: { redirect } })`.

### Task 11: Layouts and shadcn-vue primitives

**Files:**
- Run the shadcn-vue CLI: `cd apps/web && pnpm dlx shadcn-vue@2 add button input label card sidebar sheet dropdown-menu dialog select switch table separator skeleton tooltip avatar`
- Modify: `apps/web/src/stories-coverage.spec.ts`, `apps/web/CLAUDE.md` (Storybook section)
- Create: one `<Name>.stories.ts` per primitive folder, `apps/web/src/components/{AppLayout,AuthLayout,UserMenu}.vue` with stories and specs, `apps/web/.storybook/preview.ts` (viewports)

**Interfaces:**
- `AuthLayout` props: `{ title: string; description?: string }`; default slot; `footer` slot.
- `AppLayout` props: `{ user: CurrentUser }`; emits `signOut`; default slot for the page; nav items: Home (`/`), Users (`/admin/users`, admins only), rendered with `RouterLink` inside `SidebarMenuButton as-child`; top bar has `SidebarTrigger` (visible below `md`) and `UserMenu`.
- `UserMenu` props: `{ user: CurrentUser }`; emits `signOut`.

- [ ] **Step 1: Coverage rule for shadcn primitives.** Composite primitives (sidebar ships ~25 `.vue` files) cannot have one story per file. Change `stories-coverage.spec.ts`: components under `components/ui/<name>/` are covered by any `*.stories.ts` in the same folder; everything else still needs a sibling story. Add a test case for the rule. Update `apps/web/CLAUDE.md` Storybook bullet: "shadcn primitives in `src/components/ui/<name>/` need one stories file per folder covering its variants".
- [ ] **Step 2:** Run the CLI; write one stories file per primitive folder (`UI/Button` with every variant and size, etc.). Add viewport presets in `preview.ts` (`mobile` 375×667, `desktop` 1280×800) using Storybook 9's built-in viewport options (`parameters.viewport.options`).
- [ ] **Step 3: Failing component tests.** `AppLayout.spec.ts` (mount with router, i18n, `SidebarProvider` inside the layout): shows Users only for admins; `UserMenu` emits `signOut` when "Sign out" is chosen. `AuthLayout.spec.ts`: renders title and slot.
- [ ] **Step 4:** Implement. Mobile rules: top bar height ≥ 56 px, trigger button 44 × 44 px, content padding `p-4 md:p-6`, `AuthLayout` card `w-full max-w-sm` with `px-4` gutter. Stories: `Default`, `Admin`, `Mobile` (viewport `mobile`) for `AppLayout`; `Default` and `Mobile` for `AuthLayout`; `Default` for `UserMenu`. → PASS.

### Task 12: Auth pages

**Files:**
- Create: `apps/web/src/features/auth/components/{LoginForm,ForgotPasswordForm,ResetPasswordForm}.vue` with `.stories.ts` and `.spec.ts`
- Create: `apps/web/src/pages/{LoginPage,ForgotPasswordPage,ResetPasswordPage}.vue`; modify `HomePage.vue` (inside `AppLayout`, welcome with the user's name, keeps `ApiStatus`), `App.vue` if needed
- Modify: `apps/web/src/i18n/locales/en.json`

**Interfaces:**
- `LoginForm` props `{ pending?: boolean; error?: string | null }`, emits `submit: [{ email: string; password: string }]`; link to forgot password.
- `ForgotPasswordForm` props `{ pending?: boolean; sent?: boolean; error?: string | null }`, emits `submit: [{ email: string }]`; when `sent` shows the generic confirmation instead of the form.
- `ResetPasswordForm` props `{ pending?: boolean; error?: string | null; tokenMissing?: boolean }`, emits `submit: [{ password: string }]`; two fields (password, confirm); client checks length 12–128 and equality; `tokenMissing` shows an "invalid link" message with a link to request a new one.
- Pages: `LoginPage` uses `useSession().login`, then `router.replace(safeRedirect(route.query.redirect))`; 401 → "Invalid email or password"; 429 → "Too many attempts…". `ResetPasswordPage` reads `location.hash`, removes it with `history.replaceState(history.state, '', location.pathname)`, posts `/auth/password-reset/confirm`, then `router.replace({ name: 'login', query: { reset: '1' } })`; `LoginPage` shows a success note when `reset=1`.

- [ ] **Step 1: Failing component tests:** each form emits trimmed values on submit; does not emit while `pending`; shows `error` in an `role="alert"` region; inputs have labels, `type="email"`/`type="password"`, `autocomplete` (`email`, `current-password`, `new-password`); reset form rejects mismatched or short passwords without emitting.
- [ ] **Step 2:** Implement with `Card`, `Label`, `Input`, `Button` (full width, `h-11`), inputs `text-base`. Stories: `Default`, `Pending`, `Error`, `Mobile` per form (+ `Sent` and `TokenMissing`). → PASS.

### Task 13: Admin user pages

**Files:**
- Create: `apps/web/src/features/users/composables/useUsers.ts`, `useUsers.spec.ts`; `components/{UserTable,UserForm,CloseUserDialog}.vue` with stories and specs
- Create: `apps/web/src/pages/{UsersPage,UserNewPage,UserEditPage}.vue`
- Modify: `apps/web/src/i18n/locales/en.json`

**Interfaces:**
- `useUsers()`: `{ page: Ref<Page<UserDto> | null>, loading, error, query: Reactive<{ search: string; includeClosed: boolean; page: number }>, fetch(): Promise<void>, getUser(id), createUser(body), updateUser(id, body), closeUser(id) }`; `fetch` debounces search by 300 ms via `@vueuse/core` `watchDebounced` in the page, not in the composable.
- `UserTable` props `{ users: UserDto[]; loading?: boolean; total: number; page: number; pageSize: number }`, emits `select: [id: string]`, `page: [page: number]`; below `md` renders a list of cards, from `md` a table; each row/card is a button-like link (keyboard operable); closed users show a "Closed" `Badge`; users without a password show "Password not set"; prev/next buttons with "Page x of y"; empty state.
- `UserForm` props `{ initial?: UserDto; pending?: boolean; errors?: { field?: string; message?: string } | null; mode: 'create' | 'edit' }`, emits `submit: [CreateUserRequest | UpdateUserRequest]` (edit emits only changed fields), `cancel`; fields name, email, role (`Select` with the four roles, labels from i18n), locale (text input, placeholder `en-GB`, empty → `null`), time zone (`Input` with a `datalist` from `Intl.supportedValuesOf('timeZone')`, empty → `null`); server field error shown under the matching field; `rule === 'last-admin'` shown as a form-level alert.
- `CloseUserDialog` props `{ open: boolean; user: UserDto; pending?: boolean }`, emits `confirm`, `update:open`; destructive confirm button.
- Pages: `UsersPage` (search input, "Show closed" `Switch`, `UserTable`, "Add user" button; query state mirrored in the URL query); `UserNewPage` (`UserForm` create → navigate to the edit page of the new user with a success note); `UserEditPage` (load user; `UserForm` edit; "Close account" button hidden for closed users; after close → back to the list).

- [ ] **Step 1: Failing tests:** `useUsers` builds query strings (`search`, `includeClosed=true`, `page`) and maps errors; `UserTable` renders names, "Closed" badge, emits `select` on click and Enter, `page` on next/prev, disables prev on page 1; `UserForm` emits only changed fields in edit mode, converts empty locale/time zone to `null`, shows a field error under email; `CloseUserDialog` emits `confirm`.
- [ ] **Step 2:** Implement. Stories: `UserTable` (`Default`, `Loading`, `Empty`, `WithClosed`, `Mobile`), `UserForm` (`Create`, `Edit`, `Pending`, `EmailConflict`, `LastAdmin`, `Mobile`), `CloseUserDialog` (`Open`, `Pending`). → PASS.

### Task 14: Verification and documentation

- [ ] **Step 1:** `pnpm -r lint`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm --filter @offwise/api test:e2e`, `pnpm --filter @offwise/web build-storybook`, `pnpm -r format` (no diff after). Read every output.
- [ ] **Step 2:** Migration drift check (must report no changes).
- [ ] **Step 3:** `migration:run`, `install:run` (dev DB) → bootstrap admin from `.env`; `pnpm dev`; Playwright MCP at 375 × 667 and 1280 × 800: sign in as the bootstrap admin, create a user, edit, close, sign out, request a reset, open the Mailpit message, set a password, sign in as the new user and confirm the Users nav item is absent. No console errors, no failed requests other than expected 401s.
- [ ] **Step 4:** `superpowers:requesting-code-review` over the whole branch diff; fix findings.
- [ ] **Step 5:** Hand over: list of changed files, command results, known gaps. Leave everything unstaged (ADR 0004).

## Spec coverage

| Spec section | Task |
| --- | --- |
| Users, roles, locale, time zone, soft delete, email index | 3, 8 |
| Settings infrastructure, `company` namespace, encryption helper, `company.defaults` | 4 |
| Audit log, append-only trigger, Module 1 actions | 3, 4, 6, 7, 8, 9 |
| Redis sessions, sliding and absolute expiry, per-user revocation | 5, 6 |
| Throttling | 5, 6, 7 |
| CSRF | 6 |
| Password hashing, policy, rehash | 5, 6 |
| Login, logout, me | 6 |
| Password reset, mail | 7 |
| Admin user API, last-admin guard | 8 |
| First-admin bootstrap | 9 |
| Env variables, Redis and Mailpit in dev, ADR 0007, CLAUDE.md | 1, 2 |
| Web client, session, guards, locale | 10 |
| Shell, mobile-first layouts | 11 |
| Auth pages | 12 |
| Admin user pages | 13 |
| Playwright check at 375 px and desktop | 14 |

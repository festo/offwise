# Module 1: Identity & Login — Design

**Date:** 2026-10-14
**Status:** Draft (awaiting review)
**Branch:** `feat/identity-and-login`

## Goal

People can sign in to offwise with an email and a password, reset a forgotten password by email, and sign out. An admin manages user accounts. The first admin is created by the install command. The module also lays the foundations every later module uses: the settings infrastructure, the append-only audit log, the private-page shell in the web app and mobile-first UI conventions.

Authorization in this module is temporary: "signed in" and "is admin" only. Module 3 replaces it with role-based permissions.

Related: `docs/specs/2026-10-13-configuration-and-modules-design.md` (roadmap, configuration model), ADR 0002 (sessions in Redis, CSRF), ADR 0003 (settings and install steps), ADR 0006 (explicit setup commands), ADR 0007 (devcontainer).

## Scope

In scope:

- Users with name, email, role, locale and time zone; closing (soft-deleting) users.
- Password hashing, login, logout, password reset by email.
- Server-side sessions in Redis; login and reset throttling; CSRF protection.
- First-admin bootstrap in the install command.
- Settings infrastructure with the `company` namespace and the `company.defaults` install step.
- Audit log foundation.
- Admin user management (API and UI).
- Web app: auth pages, private-page shell, admin user pages; mobile-first from the start.

Out of scope:

- Welcome or invitation emails. A user created by an admin sets their password with "Forgot password".
- Reopening closed accounts. A returning employee gets a new account.
- A `status` column. Module 18 adds it with the `pending_approval` value for SSO sign-ups.
- The company settings screen and the user's own preferences screen (module 4).
- `AUTH_FORCE_PASSWORD_LOGIN` (module 18; password login cannot be switched off before then).
- Audit log search and export (module 15).
- A second UI language (module 4).

## Decisions

| Topic | Decision |
| --- | --- |
| Roles | One role per user: `employee`, `manager`, `admin`, `auditor`. All four can be assigned now; only `admin` has an effect until module 3. Whether `manager` stays a role or is derived from team management is decided in modules 2 and 3. |
| First password | No automatic email. The user uses "Forgot password". The bootstrap admin without `INITIAL_ADMIN_PASSWORD` gets a one-time link in the log. |
| Closing accounts | Soft delete through `deleted_at`. Final; no reopen. "Closed" is UI wording for `deleted_at IS NOT NULL`. |
| Email uniqueness | Case-insensitive, among non-deleted users only, so a closed user's email can be reused by a new account. A closed user's email stays editable. |
| Locale | Users and the company store a BCP 47 locale (e.g. `en-GB`), not a language. The UI language is derived from it; module 4 uses it for date and number formats. Company default: `en-GB`. |
| Password hashing | Argon2id via `@node-rs/argon2`, OWASP parameters (19 MiB, 2 iterations, parallelism 1), encoded hash string, rehash on login when parameters change. |
| Password policy | 12 to 128 characters, no composition rules, no expiry (NIST 800-63B). No breached-password check. |
| Sessions | Redis (ADR 0002). Sliding idle timeout 7 days, absolute cap 30 days. |
| Throttling | 5 login attempts per email since the last successful login (or password reset), 30 per IP, per 15 min; 3 reset requests per email per hour. Every login attempt is counted atomically before the password is verified; a successful login gives its IP attempt back and clears the email counter, so the IP budget effectively counts failures. The client IP is `req.ip`, resolved through the proxies trusted by `TRUST_PROXY`. No permanent lockout. |
| CSRF | Custom header plus Fetch Metadata with Origin fallback, `SameSite=Lax` as defence in depth (ADR 0002). |
| Audit log | Generic event rows, append-only enforced by a database trigger; includes security events (logins, resets). |
| Auth implementation | Own `SessionService` on `ioredis` and global Nest guards. No `express-session`, no Passport. |

## Data model

### PostgreSQL

One migration, generated with the TypeORM CLI. The trigger is added to the generated migration by hand, following `.claude/skills/typeorm-migrations/SKILL.md`.

**`users`** (entity in `src/modules/users/entities/user.entity.ts`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `email` | varchar(254) | stored as entered |
| `name` | varchar(200) | |
| `password_hash` | text, nullable | null until a password is set; login always fails without one |
| `role` | enum `employee`, `manager`, `admin`, `auditor` | default `employee` |
| `locale` | varchar(35), nullable | canonical BCP 47 tag; null means the company default |
| `time_zone` | varchar(64), nullable | IANA name; null means the company default |
| `created_at`, `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | `@DeleteDateColumn`; set when the account is closed |

Index: unique on `lower(email)` where `deleted_at IS NULL`.

Convention: TypeORM's `find` methods exclude soft-deleted rows. Anything that must show closed users (the "show closed" list, user detail, audit log and later reports) passes `withDeleted: true` explicitly.

**`settings`** (infrastructure, `src/settings/`)

| Column | Type | Notes |
| --- | --- | --- |
| `namespace` | varchar(100) | primary key |
| `value` | jsonb | validated against the namespace's DTO on every write |
| `updated_at` | timestamptz | |
| `updated_by_user_id` | uuid, nullable | FK to `users` |

**`audit_events`** (infrastructure, `src/audit/`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `occurred_at` | timestamptz | default `now()` |
| `actor_user_id` | uuid, nullable | FK to `users`; null for system and install actions |
| `action` | varchar(100) | dotted name, e.g. `user.created` |
| `entity_type` | varchar(50), nullable | e.g. `user`, `settings` |
| `entity_id` | varchar(100), nullable | |
| `before`, `after` | jsonb, nullable | changed fields only; secrets redacted |
| `ip` | inet, nullable | |

Indexes on `occurred_at`, `(entity_type, entity_id)` and `actor_user_id`. A `BEFORE UPDATE OR DELETE` trigger raises an exception, so rows cannot be changed even by hand. `TRUNCATE` does not fire row triggers, so `resetDatabase()` in e2e tests keeps working.

### Redis

Accessed through `ioredis`. Development uses logical database 0, e2e tests use database 1.

| Key | Value | TTL |
| --- | --- | --- |
| `session:{sha256(id)}` | hash: `userId`, `createdAt`, `lastSeenAt` | min(7 days, time left to the 30-day cap) |
| `user-sessions:{userId}` | set of session key hashes; stale entries pruned when read | 30 days |
| `throttle:login:email:{lower(email)}` | counter | 15 min |
| `throttle:login:ip:{ip}` | counter | 15 min |
| `throttle:reset:email:{lower(email)}` | counter | 1 hour |
| `password-reset:{sha256(token)}` | `userId` | 1 hour; 24 hours for the bootstrap link |

- Session ids and reset tokens are 32 random bytes, base64url-encoded. Only their SHA-256 hashes are stored, so a Redis dump cannot be used to hijack sessions or reset passwords.
- A session's `lastSeenAt` and TTL are refreshed at most once a minute, not on every request.
- Reset tokens are single-use (`GETDEL`). A successful reset deletes all of the user's sessions and any other outstanding reset token for that user (tracked in a `user-resets:{userId}` set with the same TTL rules as `user-sessions`).

### Settings

- `SettingsService.get(namespace)` returns the stored value merged over the namespace's code defaults; `set(namespace, value, actor)` validates, writes, audits (`settings.updated`, with secret fields redacted) and invalidates the in-process cache.
- Each namespace registers a class-validator DTO, its defaults and the list of secret fields. Secret fields are encrypted with AES-256-GCM using `ENCRYPTION_KEY` and never returned by the API. Module 1 has no secret fields but ships the encrypt/decrypt helper with tests for modules 13 and 18.
- Module 1 defines the `company` namespace: `{ name: string, locale: string }`, defaults `"offwise"` and `"en-GB"`. Module 4 adds the remaining company fields.
- The `company.defaults` install step writes the `company` row with these defaults.
- No settings endpoints in this module. `GET /auth/me` returns the user's locale and time zone with company defaults applied; the company settings screen is module 4.

## API

All routes are under `/api`. Request and response contracts live in `@offwise/shared` (`auth.ts`, `users.ts`), and the API DTOs implement them.

### Guards

Three global guards, in this order:

1. **`CsrfGuard`** on POST, PUT, PATCH and DELETE: requires `X-Requested-With: offwise`; if `Sec-Fetch-Site` is present it must be `same-origin`; if it is absent, `Origin` must equal the origin of `PUBLIC_URL`; if both are absent the request is rejected. Failures return 403. CORS is never enabled.
2. **`AuthGuard`**: reads the signed `offwise_session` cookie (`cookie-parser` with `SESSION_SECRET`), loads the session from Redis and the user from PostgreSQL (non-deleted only), refreshes the session and attaches the user to the request. Missing or invalid sessions return 401. Routes opt out with `@Public()`.
3. **`AdminGuard`**: routes marked `@AdminOnly()` require `role = admin`, otherwise 403.

The health endpoint is `@Public()`. Every request reads the user from PostgreSQL, so role changes apply on the next request.

### Cookie

`offwise_session`: httpOnly, `SameSite=Lax`, `Secure` unless `NODE_ENV=development`, `Path=/api`, signed. `Max-Age` is set at login to the 30-day absolute cap, so the cookie survives closing the browser; the server-side TTL decides whether the session is still valid. Logout and an expired session clear the cookie.

### Auth endpoints

| Endpoint | Access | Behaviour |
| --- | --- | --- |
| `POST /auth/login` `{ email, password }` | public | 200 with `CurrentUser` and the cookie; 401 `Invalid email or password`; 429 with `Retry-After` when throttled |
| `POST /auth/logout` | signed in | 204; deletes the session and clears the cookie |
| `GET /auth/me` | signed in | `CurrentUser`; 401 if not signed in |
| `POST /auth/password-reset` `{ email }` | public | always 202; 429 when the per-email limit is exceeded |
| `POST /auth/password-reset/confirm` `{ token, password }` | public | 204; 400 if the token is invalid or expired, or the password breaks the policy |

`CurrentUser`: `id`, `name`, `email`, `role`, `locale` and `timeZone` (never null: the user's own value, or the company default when they have not set one; the admin `UserDto` keeps the stored, nullable values). The company default time zone is `UTC` until module 4 adds the setting.

### User endpoints (admin only)

| Endpoint | Behaviour |
| --- | --- |
| `GET /users?search=&includeClosed=&page=&pageSize=` | Paginated list (`page` from 1, `pageSize` default 25, max 100), sorted by name. `search` matches name or email, case-insensitively. |
| `GET /users/:id` | One user, closed users included. 404 if unknown. |
| `POST /users` `{ name, email, role, locale?, timeZone? }` | 201 with the user. 409 if a non-deleted user has the email. |
| `PATCH /users/:id` `{ name?, email?, role?, locale?, timeZone? }` | 200 with the user. Allowed on closed users. 409 on a duplicate email among non-deleted users, or when it would demote the last active admin. |
| `DELETE /users/:id` | 204. Closes the account: sets `deleted_at`, ends all sessions. 409 for the last active admin, including an admin closing themselves. 404 if already closed. |

User responses never include `password_hash`. They include `hasPassword: boolean` and `closedAt` (from `deleted_at`).

Validation: `name` 1 to 200 characters, trimmed; `email` a valid address up to 254 characters; `locale` canonicalised with `Intl.getCanonicalLocales` and rejected if invalid; `timeZone` must be accepted by `Intl.DateTimeFormat`.

### Flows

**Login**

1. Count every attempt atomically against the email and IP throttle counters before verifying; if either is over its limit, return 429 without verifying the password.
2. Find the non-deleted user by `lower(email)`.
3. Verify the password with Argon2. If the user does not exist or has no password, verify against a fixed dummy hash, so the response time does not reveal whether the account exists.
4. On failure, audit `auth.login_failed` (entity is the user if found; the attempted email is in `after`). Return 401.
5. On success, give the attempt back to the IP counter (decrement, never below 0), clear the email counter, rehash if the hash parameters are outdated, create the session, set the cookie and audit `auth.login_succeeded`.

**Password reset**

1. `POST /auth/password-reset` checks and increments the per-email counter and returns 202.
2. After the response, if a non-deleted user has the email, the API creates a token and sends the email; an `auth.password_reset_requested` event is audited. Unknown emails send nothing and audit nothing.
3. The email link is `${PUBLIC_URL}/reset-password#token=<token>`. The token sits in the fragment, so it never reaches server logs or `Referer` headers.
4. `POST /auth/password-reset/confirm` reads the token with `GETDEL`, validates the password, and in one transaction stores the new hash, audits `auth.password_reset_completed`, and deletes all of the user's sessions and other reset tokens (a Redis failure rolls the password change back). It then clears the login email throttle counter for that email.

**Closing a user:** in one transaction, set `deleted_at` and audit `user.closed`; after the commit, delete the user's sessions from Redis.

**First-admin bootstrap** (install command, after the install steps; ADR 0006)

Runs only when `INITIAL_ADMIN_EMAIL` is set and no non-deleted admin exists:

- If a non-deleted user has that email, promote them to `admin`. Promotion keeps the user's existing password; `INITIAL_ADMIN_PASSWORD` is ignored for them, and a one-time link is logged only when they have no password.
- Otherwise create an admin with that email and the name "Administrator".
- For a new admin with `INITIAL_ADMIN_PASSWORD`, set that password (it must meet the policy, otherwise the command fails with a clear message).
- For a new admin without it, log a one-time reset link valid for 24 hours.
- Audit `user.created` or `user.role_changed` with a null actor.

If an admin exists, the bootstrap does nothing, so leaving the variables set is harmless.

The link is printed to stdout, where CI and container logs may keep it, so automated environments should prefer `INITIAL_ADMIN_PASSWORD`.

### Audit

`AuditService.record({ actor, action, entityType, entityId, before, after, ip })` takes the caller's `EntityManager`, so the event is written in the same transaction as the change it records. It has no update or delete method.

Module 1 actions: `user.created`, `user.updated`, `user.role_changed`, `user.closed`, `settings.updated`, `auth.login_succeeded`, `auth.login_failed`, `auth.logout`, `auth.password_reset_requested`, `auth.password_reset_completed`. `before` and `after` hold only the fields that changed.

### Mail

`MailService` wraps nodemailer with the env SMTP settings. Module 1 has one template, the password reset email, in English, as plain text and HTML. Send failures are logged and do not change the 202 response.

### Errors

Nest HTTP exceptions with clear messages. Field errors use the `ValidationPipe` format, and 409 responses name the conflicting field (`email`) or rule (`last-admin`), so the web app can place the message.

## Web app

### Routes

| Path | Page | Access |
| --- | --- | --- |
| `/login` | Email and password form | signed out only; signed-in users go to `/` |
| `/forgot-password` | Email form, then a generic confirmation ("If an account exists for this email, we've sent a link") | public |
| `/reset-password` | Reads `#token`, removes it from the URL with `history.replaceState`, shows the new-password form; on success goes to `/login` with a confirmation | public |
| `/` | Home: welcome message and the existing API status | signed in |
| `/admin/users` | User list with search, "show closed" toggle and pagination | admin |
| `/admin/users/new` | Create form | admin |
| `/admin/users/:id` | Edit form, with "Close account" behind a confirmation dialog | admin |

### Shell and components

- `AppLayout` for signed-in pages: a sidebar with navigation (Users only for admins) and a top bar with `UserMenu` (name, email, "Sign out").
- `AuthLayout` for public pages: a centred card.
- `features/auth/`: `LoginForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `useSession`.
- `features/users/`: `UserTable`, `UserForm`, `CloseUserDialog`, `useUsers`.
- `components/`: `AppLayout`, `AuthLayout`, `UserMenu`.
- shadcn-vue primitives added with the CLI as needed (Sidebar, Sheet, Card, Input, Label, Button, Table, Dialog, Select, DropdownMenu, Switch), each with its story.
- Pages are thin wrappers that compose feature components.

### Session state

`useSession()` holds module-level reactive state (no Pinia): `user`, `load()` (`GET /auth/me`), `login()`, `logout()`. A router `beforeEach` calls `load()` once per page load and enforces `meta.public` and `meta.admin`. Any 401 from the API clears the session and redirects to `/login?redirect=<path>`; the redirect only accepts paths inside the app.

### API client

`lib/api.ts` gains `apiPost`, `apiPatch` and `apiDelete`. Every request sends `X-Requested-With: offwise`. Error responses become `ApiError` objects carrying the status, message and field errors, so forms can show a duplicate email next to the field and a 429 as a "try again later" message.

### Localization

All strings go through `t()`. After `load()`, vue-i18n switches to the language subtag of the user's `locale` (`hu-HU` → `hu`) if that translation exists, otherwise `en`. Only `en` exists in this module.

### Validation

Client-side checks are minimal (required fields, email format, password length 12 to 128). The API is the source of truth; its messages are shown next to the fields.

### Mobile first

From this module on, every screen works on a phone. The rules go into `apps/web/CLAUDE.md`:

- Styles are written mobile first: base classes target the phone, `sm:`, `md:` and `lg:` add to them. Minimum supported width 360 px, with no horizontal page scroll.
- Touch targets are at least 44 × 44 px. Form inputs use a font size of at least 16 px, so iOS does not zoom on focus. Forms are single-column on phones.
- Nothing depends on hover.
- Layout-sensitive components have a `Mobile` story that sets Storybook's mobile viewport.
- A Playwright MCP check of a page covers 375 px and a desktop width.

Module 1 specifics:

- `AppLayout`: below `md`, the sidebar is off-canvas (shadcn-vue `Sidebar` renders a `Sheet`), opened from a menu button in the top bar.
- `UserTable`: below `md`, rows render as stacked cards (name, email, role, "Closed" badge); search and the toggle stack above; pagination shows previous and next only.
- `UserForm`: full-width fields. `CloseUserDialog` is full width on phones.
- Auth pages: the card fills the width on phones, with a 16 px gutter.

## Configuration and environment

New environment variables (zod schema and `apps/api/.env.example`):

| Variable | Required | Validation and dev value |
| --- | --- | --- |
| `REDIS_URL` | yes | `redis://` or `rediss://` URL; dev `redis://localhost:6379/0` |
| `PUBLIC_URL` | yes | absolute `http(s)` URL; dev `http://localhost:5173` |
| `SESSION_SECRET` | yes | at least 32 characters; the `.env.example` placeholder is rejected when `NODE_ENV=production` |
| `ENCRYPTION_KEY` | yes | base64 that decodes to exactly 32 bytes; the `.env.example` placeholder is rejected when `NODE_ENV=production` |
| `SMTP_HOST`, `SMTP_PORT` | yes | dev Mailpit `localhost`, `1025` |
| `SMTP_USER`, `SMTP_PASSWORD` | no | |
| `SMTP_SECURE` | no (default false) | boolean |
| `MAIL_FROM` | yes | email address; dev `offwise <noreply@offwise.local>` |
| `INITIAL_ADMIN_EMAIL` | no | email address |
| `INITIAL_ADMIN_PASSWORD` | no | must meet the password policy if set |
| `TRUST_PROXY` | no (default `loopback`) | `true`, `false`, a hop count, or a comma-separated list of IPs, CIDRs and the presets `loopback`, `linklocal`, `uniquelocal`; passed to Express `trust proxy` |

The e2e test env uses Redis database 1 and the same Mailpit.

Development environment:

- Root `docker-compose.yml` gains a `redis` service (`redis:8-alpine`, `appendonly yes`, `appendfsync everysec`, named data volume, health check) and a `mailpit` service, so host-based development and e2e tests have them too.
- The devcontainer puts `redis` in `db`'s network namespace like `mailpit`, so it is on `localhost:6379`, and `workspace` waits for it to be healthy.
- ADR 0007 and the CLAUDE.md files are updated to list Redis.

Dependencies (in `apps/api`): `ioredis`, `@node-rs/argon2`, `cookie-parser`, `nodemailer` and their types.

## Testing

**API unit tests**

- `SessionService`: create, sliding refresh at most once a minute, absolute cap, destroy, destroy all for a user, stale set entries.
- `ThrottleService`: limits, windows, reset of the email counter on success.
- `CsrfGuard`: every header combination, including absent headers and non-mutating methods.
- Password hashing: verify, dummy-hash path, rehash on outdated parameters, policy limits.
- Users service: last-admin rule (close, demote, self), duplicate email among non-deleted users only, locale and time zone canonicalisation.
- `AuditService`: changed-field diff, redaction.
- `SettingsService`: defaults merge, validation, cache invalidation, encrypt/decrypt round trip.
- Bootstrap: no variable, admin exists, promote existing user, create with password, create with link, invalid password.

**API e2e tests** (Postgres `offwise_test`, Redis database 1 flushed per suite, Mailpit HTTP API to read emails)

- Login, me and logout; wrong password; unknown email; closed user cannot sign in; throttling returns 429.
- Password reset end to end: request, read the email from Mailpit, confirm, old sessions gone, token cannot be reused.
- CSRF: mutation without the header, with a cross-site `Sec-Fetch-Site`, with a foreign `Origin`, with neither header.
- Users: CRUD as admin, 403 as non-admin, 401 signed out, 409 on duplicate email, reuse of a closed user's email, last-admin conflicts, closed user's sessions ended.
- Audit: events written for user changes and logins; `UPDATE` on `audit_events` fails.
- Install command: `company.defaults` row; bootstrap admin created and able to sign in.

**Web**

- Component tests: forms (validation, API error display, emitted events), `UserTable` (cards and table), `useSession`, router guards and redirect handling.
- Stories for every component in default, loading, empty, error and disabled states where relevant, plus `Mobile` variants for layout-sensitive components.
- Before handing over: a Playwright MCP check of the login, reset and user pages at 375 px and desktop width, with no console errors or failed requests.

## Documentation changes in this module

- ADR 0002 (sessions in Redis, throttling, AOF, CSRF), already updated on this branch.
- `docs/decisions/README.md` (ADRs are edited in place) and ADRs 0001, 0003 and 0006 (merged supersessions and stale text), already updated on this branch.
- ADR 0007: Redis in the devcontainer.
- `docs/specs/2026-10-13-configuration-and-modules-design.md`: `REDIS_URL`, locale instead of language, `AUTH_FORCE_PASSWORD_LOGIN` moved to module 18.
- `apps/web/CLAUDE.md`: mobile-first rules.
- `apps/api/CLAUDE.md` and root `CLAUDE.md`: Redis in the commands and conventions (e.g. `docker compose up -d db redis mailpit`).

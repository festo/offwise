# Configuration Model and Module Roadmap — Design

**Date:** 2026-10-13
**Status:** Approved

## Goal

Before writing application code, agree on two things for offwise, based on the product feature specification (`docs/specs/product-feature-specification.md`):

1. **Configuration model:** what lives in environment variables, what is an admin-editable setting stored in the database, what is seeded on install, and what is dev-only fixture data.
2. **Module roadmap:** how the feature set splits into separately specified, planned and shipped modules, and in which order.

Each module in the roadmap gets its own spec, plan and implementation cycle on its own branch. This document does not design any module in detail.

Related ADRs: 0002 (server-side sessions in Redis), 0003 (settings and install steps), 0006 (migrations and install as explicit commands), 0007 (devcontainer for development).

## Part 1: Configuration model

### Principle

- **Env** holds what the process needs before it can talk to anyone: infrastructure, secrets and bootstrap values. Changing env requires a restart.
- **DB settings** hold everything the feature spec says "an admin configures". They are edited in the UI and every change is written to the audit log.
- **Install steps** seed defaults once per installation.
- **Dev fixtures** create demo data and never run in production.

Each env var and setting names the module that introduces it. A module adds only the configuration it uses.

### Environment variables

Validated at API startup. A missing or invalid value stops the process with a clear message.

| Variable | Required | Purpose | Module |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test` or `production` | 0 |
| `PORT` | no (default 3000) | API port | 0 |
| `LOG_LEVEL` | no (default `info`) | log verbosity | 0 |
| `DATABASE_URL` | yes | PostgreSQL connection string | 0 |
| `REDIS_URL` | yes | Redis connection string for sessions and login throttling (ADR 0002) | 1 |
| `PUBLIC_URL` | yes | Public web origin; used for email links, OIDC redirect URI, iCal URLs and cookie settings | 1 |
| `SESSION_SECRET` | yes | Signs the session cookie | 1 |
| `ENCRYPTION_KEY` | yes | 32-byte key (base64) that encrypts secrets stored in the DB (OIDC client secret, Slack token) | 1 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | host and port yes | Outgoing mail (password reset, notifications) | 1 |
| `MAIL_FROM` | yes | Sender address | 1 |
| `INITIAL_ADMIN_EMAIL` | no | First-admin bootstrap (see below) | 1 |
| `INITIAL_ADMIN_PASSWORD` | no | Optional password for the bootstrap admin | 1 |
| `AUTH_FORCE_PASSWORD_LOGIN` | no (default false) | Emergency access: enables password sign-in regardless of the DB setting, for when SSO is misconfigured and admins are locked out | 18 |

Rules:

- `.env*` files are gitignored; a committed `.env.example` documents every variable.
- SMTP stays in env, not the DB, because password reset must work before any admin has configured anything.
- Docker compose runs Mailpit (and Redis, from module 1) for development, and the dev `.env.example` points SMTP at it.
- The web app has **no runtime env**. It calls `/api` on its own origin, through the Vite proxy in development and a reverse proxy in deployed setups (deployment module). Same-origin requests keep session cookies simple and avoid CORS.

### DB settings

Stored in a `settings` table with one row per **namespace**, holding a `jsonb` value:

- The module that owns a namespace defines a DTO for its value and its defaults in code. Values are validated on every write.
- A namespace with no row uses its code defaults, so adding a setting needs no data migration.
- Settings are read through a `SettingsService` with an in-process cache that is invalidated on write.
- Every write produces an audit log entry with the old and new value. Secret fields are redacted in the audit log.
- Secret fields are encrypted at rest with `ENCRYPTION_KEY` and never returned by the API; the UI only shows whether they are set.

| Namespace | Contents | Module |
| --- | --- | --- |
| `company` | name, default locale (BCP 47, e.g. `en-GB`), first day of week, leave year start month, default time zone | 1 (name, locale), 4 (rest) |
| `auth` | password sign-in enabled, SSO enabled, OIDC issuer, client id, client secret (encrypted) | 1 (password), 18 (SSO) |
| `approval` | managers may approve their own leave, reminder delay | 8, 12 |
| `visibility` | board scope: company, own team, or own leave | 11 |
| `notifications.slack` | bot token (encrypted), channels, digest settings | 13 |

Not stored as settings:

- **Per-user preferences** (locale, time zone) are columns on the user row, and override the company defaults. The UI language is derived from the locale's language subtag.
- **Domain configuration** (schedules, holiday groups, leave types, allowances, coverage rules, webhooks) is ordinary relational data in tables owned by its module.

### Install steps

Modules ship one at a time, so a single "installed" marker would miss the defaults of later modules. Instead:

- Each module registers named install steps, e.g. `org.root-team`.
- Each step that has run is recorded in an `install_steps` table (name, applied at).
- Neither migrations nor install steps run automatically, and the API does not check for either (ADR 0006). The operator runs them before starting the API: migrations with `migration:run` (development) or `docker compose run --rm migrate` (containers), then install steps with `install:run` or `docker compose run --rm install`.
- The install command executes every unrecorded step in registration order. Each step runs in its own transaction together with its record row; concurrent runs are serialised by an advisory lock.
- A step runs **exactly once per installation**. An existing installation that upgrades to a new module gets that module's defaults once. Defaults an admin later edits or deletes are never recreated.
- Steps live in typed TypeScript files next to their module and are unit-tested.

Planned steps:

| Step | Seeds | Module |
| --- | --- | --- |
| `company.defaults` | `company` settings row with name "offwise", locale `en-GB` | 1 |
| `org.root-team` | Root team named after the company; existing users join it | 2 |
| `schedules.default` | Company default schedule, Monday to Friday | 5 |
| `leave-types.defaults` | Vacation, Sick leave and Unpaid leave, with defaults defined in the module 7 spec | 7 |

No holiday groups are seeded, because the app does not assume a country.

### First-admin bootstrap

This runs in the install command (ADR 0006), after the install steps:

- If `INITIAL_ADMIN_EMAIL` is set **and no active admin exists**, create an active admin with that email.
- With `INITIAL_ADMIN_PASSWORD`, that password is set. Without it, a one-time password-setup link is written to the log.
- If an active admin exists, the check does nothing, so leaving the variables set is harmless.

### Dev fixtures

- `pnpm --filter @offwise/api seed:demo` creates a demo company: a team tree, users in every role, schedules, holiday groups and leave in various states. It grows as modules land.
- It refuses to run when `NODE_ENV=production`.
- E2E tests do not use the demo seed; they build their own data with factories.

## Part 2: Module roadmap

Every module is a complete vertical slice: API, web UI including admin screens, migrations, install steps, tests and Storybook stories where relevant. Each one leaves `main` working and shippable. Contract changes in `packages/shared` ship with the module that introduces them.

| # | Module | Scope | Depends on |
| --- | --- | --- | --- |
| 0 | Scaffolding | pnpm workspaces; NestJS and Vue apps; `@offwise/shared`; devcontainer for local development with `db` and Mailpit, `pnpm dev` (ADR 0007); env validation; TypeORM data source and migrations (explicit command only); install-step runner and `install` command (ADR 0006); no startup checks in the API; health endpoint; vue-i18n with English only; `lint`, `typecheck`, `test`, `format` and the other scripts required by `CLAUDE.md` | — |
| 1 | Identity & login | Users (name, email, role, locale, time zone); password hashing; server-side sessions; login and logout; password reset by email; first-admin bootstrap; settings infrastructure; audit log foundation (append-only, used by every later module); admin user management (add, edit, close, set role); private-page shell in the web app. Temporary authorization: "signed in" and "is admin" only | 0 |
| 2 | Org structure | Team tree; team managers, who may belong to a different team; membership with history, so moves keep history; manager-chain resolution; `org.root-team` step; admin UI for the tree | 1 |
| 3 | Access control | Roles (Employee, Manager, HR/Admin, Auditor) mapped to permissions with scopes (own, managed subtree, company); Auditor read-only; replaces the temporary guards from module 1; route and menu guards in the web app | 2 |
| 4 | Company settings & localization | Admin company settings screen; user locale and time zone preferences; date formats by locale; "today" in the user's time zone; first day of week; a second UI language to prove i18n end to end | 3 |
| 5 | Working schedules | Effective-dated schedules at company, team and user level; "most specific wins" resolver; past leave never recalculated; `schedules.default` step | 2, 4 |
| 6 | Holiday groups | Groups with per-year dated holidays (full or half day); copy previous year; assignment to teams and users with effective dates; combined holidays across groups; optional substitute days | 2 |
| 7 | Leave types & allowances | Type configuration (name, color, balance or unlimited, approval required, half days, private reason, availability to teams and people); archiving; annual allowances at company, team and person level; `leave-types.defaults` step | 3 |
| 8 | Leave requests & approval | Day-count engine (schedule, holidays, half days; reference case #1); request form showing the deduction and resulting balance; statuses and transitions; approval chain and self-approval setting; HR acts on any request (#2, #9); creating leave on someone's behalf; shorten, extend, edit and cancel rules (#3); simple balance check (allowance minus used) | 5, 6, 7 |
| 9 | Balances & accrual | Upfront and monthly accrual; pro-rating for joiners, leavers and part-time, with HR override (#4); tenure bonus; carry-over with maximum and expiry, carried-over days used first; manual adjustments with comment; leave spanning two leave years (#8); full balance breakdown | 8 |
| 10 | Coverage rules | Minimum staffing; blackout periods (company or team, optionally per type); non-bookable days; manager and HR overrides recorded in the audit log (#5) | 8 |
| — | **Usable MVP** | | |
| 11 | Board, dashboard & privacy | Company monthly board with team, person and type filters; pending vs. approved leave; blackouts and non-bookable days shown; personal and manager dashboards; private leave types; `visibility` setting | 8, 10 |
| 12 | Email notifications | Internal event bus; every event in the feature spec; per-user email preferences; emails in the recipient's language; pending-request reminders | 8 |
| 13 | Slack & webhooks | Slack direct messages, channel posts and out-of-office status; daily and weekly digests by Slack or email; webhooks with per-URL event selection | 12 |
| 14 | Calendar feeds | iCal feeds per person, team and company, respecting privacy | 11 |
| 15 | Reports & export | Leave taken, balances at any date, absence trends, leave by type and period (#6); CSV and Excel export; audit log search and export | 9 |
| 16 | Year-end close | Preview, then run manually or on a set date; applies carry-over and opens the new year | 9 |
| 17 | Employee lifecycle | Start and end dates; leaver handling: pro-rating, balance at end date, future leave cancelled, account closed and soft-deleted (#7); CSV bulk import of users and opening balances | 9 |
| 18 | SSO (OIDC) | Admin-configured OIDC provider; first SSO sign-in creates an account waiting for HR approval; password and SSO on/off switches; `AUTH_FORCE_PASSWORD_LOGIN` | 3 |
| 19 | Public REST API | API tokens for integrations; documented endpoints for users, teams, leave, balances and reports | 3, 15 |
| 20 | Deployment | Production images for API and web, reverse proxy serving the web app and `/api`, one-shot `migrate` and `install` compose services (ADR 0006), upgrade guide | 0 (can move earlier when a deployable build is needed) |

Numbers in parentheses refer to the reference use cases in the feature specification.

Notes:

- The audit log and the settings infrastructure are built in module 1 and used by every later module. Search and export of the audit log arrive with module 15.
- Modules 5, 6 and 7 are independent of each other once their dependencies are met, and can be built in parallel.
- Module 18 (SSO) only depends on module 3 and can be moved earlier if needed. Password login covers development until then.

## Future requirements

Not part of the roadmap; to be specified when prioritized:

- **Attachments on leave requests**, including the leave type setting "attachment required, optionally only above a number of days". This will add storage configuration to env (driver, local path or S3 credentials).

## Decisions

| Decision | Choice | Record |
| --- | --- | --- |
| Integration credentials | SMTP in env; SSO and Slack in DB settings, encrypted with `ENCRYPTION_KEY` | this spec |
| First admin | `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`, applied only when no active admin exists | this spec |
| Seeding | Named, once-per-installation install steps recorded in `install_steps` | ADR 0003 |
| When setup runs | Migrate, install and start are three explicit operator steps; the API checks and runs neither | ADR 0006 |
| Admin settings storage | Namespaced `jsonb` settings with module-owned DTOs and code defaults | ADR 0003 |
| Web sessions | Server-side sessions in Redis (AOF persistence), opaque id in an httpOnly secure cookie | ADR 0002 |
| Module order | Org structure (2) before access control (3) | this spec |

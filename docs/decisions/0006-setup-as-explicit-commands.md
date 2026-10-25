# 0006: Migrations and install steps run as explicit operator commands

**Status:** Accepted
**Date:** 2026-10-14

## Context
Schema migrations and install steps (ADR 0003) must run before a new version of the API serves requests. An API that applies them on startup, or refuses to start while they are pending, writes setup data with its runtime privileges, lets several replicas race on startup, and turns a failed setup into a crashing API. Self-hosted apps (Mastodon, GitLab, Sentry, Plausible) instead treat schema changes and initial setup as explicit operator commands run before the app starts.

## Decision
- **Migrations** run only through an explicit command: `migration:run` (development, TypeScript sources) or `migration:run:dist` (`node dist/migrate.js`, against a build).
- **Install steps** run only through an explicit command: `install:run` (development) or `install:run:dist` (`node dist/install.js`, against a build). The command starts a Nest application context (no HTTP server), applies every unrecorded step in registration order, each in its own transaction with its record row, serialised across concurrent runs by a Postgres advisory lock. The first-admin bootstrap (`INITIAL_ADMIN_EMAIL`) also runs in this command, not in the API.
- **The API does not check** for pending migrations or install steps and does not run either. It starts with whatever schema and data it finds. Running both commands before starting a new version is the maintainer's responsibility.
- A deploy or upgrade is three steps: migrate, install, start the API. The deployment module (roadmap module 20) wraps the `:dist` commands as one-shot compose services, `docker compose run --rm migrate` and `docker compose run --rm install`.

## Consequences
- The API process needs no DDL privileges and never seeds data.
- Starting the API against an outdated schema fails at the first query that needs the missing table or column, not at boot. Upgrade instructions (README) must state the three steps.
- E2E test setup runs the migration command against `offwise_test`; tests that need seeded defaults run the install runner themselves.
- Both commands are idempotent and safe to re-run on every deploy.

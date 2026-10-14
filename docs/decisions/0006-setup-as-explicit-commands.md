# 0006: Migrations and install steps run as explicit operator commands

**Status:** Accepted
**Date:** 2026-10-14
**Supersedes:** 0003 (only the part saying when install steps run; the settings model and the install-step model stand)

## Context
ADR 0003 had the API apply pending install steps on startup, and the API was also planned to refuse to start while migrations were pending. Self-hosted apps (Mastodon, GitLab, Sentry, Plausible) instead treat schema changes and initial setup as explicit operator commands run before the app starts. That keeps the API from writing setup data with its runtime privileges, avoids several replicas racing on startup, and makes a failed setup a visible, re-runnable step instead of a crashing API.

## Decision
- **Migrations** run only through an explicit command: `migration:run` (development) or `docker compose run --rm migrate` (containers, `node dist/migrate.js`).
- **Install steps** run only through an explicit command: `install:run` (development) or `docker compose run --rm install` (containers, `node dist/install.js`). The command starts a Nest application context (no HTTP server), applies every unrecorded step in registration order, each in its own transaction with its record row, serialised across concurrent runs by a Postgres advisory lock. The first-admin bootstrap (`INITIAL_ADMIN_EMAIL`) also runs in this command, not in the API.
- **The API does not check** for pending migrations or install steps and does not run either. It starts with whatever schema and data it finds. Running both commands before starting a new version is the maintainer's responsibility.
- A deploy or upgrade is three steps: migrate, install, start the API.

## Consequences
- The API process needs no DDL privileges and never seeds data.
- Starting the API against an outdated schema fails at the first query that needs the missing table or column, not at boot. Upgrade instructions (README) must state the three steps.
- E2E test setup runs the migration command against `offwise_test`; tests that need seeded defaults run the install runner themselves.
- Both commands are idempotent and safe to re-run on every deploy.

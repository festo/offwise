# 0003: Namespaced DB settings and once-per-installation install steps

**Status:** Accepted; when install steps run is superseded by 0006
**Date:** 2026-10-13

## Context
Admins configure many company-wide options in the UI, and modules ship one at a time, each adding settings and default data (root team, default schedule, default leave types). Defaults must be seeded once and never recreated after an admin edits or deletes them, including on installations that upgrade to a new module.

## Decision
- **Settings:** a `settings` table with one `jsonb` row per namespace (`company`, `auth`, ...). The owning module defines a validated DTO and code defaults; a missing row means defaults. Secret fields are encrypted with `ENCRYPTION_KEY` and never returned by the API. Every write is audited.
- **Install steps:** modules register named steps; an `install_steps` table records applied steps. After migrations, the API runs each unrecorded step once, in its own transaction with its record row.
- Infrastructure and secrets needed before any admin exists stay in environment variables.

See `docs/specs/2026-10-13-configuration-and-modules-design.md`.

## Consequences
- Adding a setting needs no migration; changing its shape needs DTO-level compatibility (defaults for new fields).
- Settings are not queryable relationally; domain configuration (schedules, leave types, ...) therefore stays in ordinary tables.
- Seed data is code that is unit-tested, separate from schema migrations.
- Renaming a step makes it run again; step names are permanent.

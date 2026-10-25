---
name: typeorm-migrations
description: Use when an offwise API entity changes, a table/column/index is added or removed, data must be backfilled, or a file in apps/api/src/migrations is created, edited, reviewed, renamed or deleted — including when an existing migration looks hand-written.
---

# TypeORM migrations in offwise

## Overview

Migration files are **created by the TypeORM CLI, never typed from scratch**. The CLI picks the file name, the timestamp and the class name; you only choose the PascalCase name. The generated raw SQL is then **rewritten with the TypeORM schema API** (`createTable`, `addColumn`, `createIndex`, `createForeignKey`, …) for readability, and the drift check proves the rewrite matches the entities. Raw `queryRunner.query()` stays only for what the API cannot express (expression or partial indexes on expressions, triggers, functions, data backfills), with a comment saying why.

## Commands (run from the repo root)

| Need | Command |
| --- | --- |
| Postgres for dev and e2e | `docker compose up -d db` |
| Apply pending migrations (dev DB) | `pnpm --filter @offwise/api migration:run` |
| Schema change from entity changes | `pnpm --filter @offwise/api migration:generate <PascalName>` |
| Empty migration for data / manual SQL | `pnpm --filter @offwise/api migration:create <PascalName>` |
| Undo the last applied migration | `pnpm --filter @offwise/api migration:revert` |
| Drift check | `pnpm --filter @offwise/api migration:generate Check` → must print `No changes in database schema were found` and create no file. It exits non-zero even then, so pnpm prints `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`: expected; judge by the message and by `git status` |

All of them use `apps/api/src/data-source.ts` and `apps/api/.env`. To target the e2e database, prefix with `DATABASE_URL=postgresql://offwise:offwise@localhost:5432/offwise_test`.

The API never migrates and never checks for pending migrations (ADR 0006); running them before starting it is the maintainer's job. Migrations are found by glob (`src/migrations/*`); there is no list to register them in.

## Schema change workflow

1. `docker compose up -d db`, then `migration:run` so the dev DB is current. There is no offline alternative: `generate` diffs entities against the live schema.
2. Change the entity. Register a **new entity** in `src/database/entities.ts`.
3. `migration:generate <PascalName>` (e.g. `AddDisplayNameToUsers`).
4. Rewrite the generated `up()`/`down()` with the schema API, keeping the file name, class name and `name` property. Carry over every constraint and index name exactly (`primaryKeyConstraintName`, `indices[].name`, `foreignKeys[].name`), every length, default (string literals quoted: `default: "'employee'"`), nullability and `onDelete`. UUID keys: `isGenerated: true, generationStrategy: 'uuid'` (gives `gen_random_uuid()`). Put a table's indices and foreign keys in its `new Table({...})`; `dropTable(name)` in `down()` drops them too. See `src/migrations/1792429690270-CreateIdentity.ts`.
5. `pnpm --filter @offwise/api format` (the CLI output is not Prettier-formatted).
6. Review the file:
   - Table and column names are snake_case (the naming strategy does this; explicit `name:` must be snake_case too).
   - `down()` exactly undoes `up()`.
   - Drops, renames or data rewrites need explicit human approval in the PR (`apps/api/CLAUDE.md`).
7. `migration:run`, then the drift check (it is what proves the rewrite equals the generated SQL), then `migration:revert` and `migration:run` again to exercise `down()`, then `pnpm --filter @offwise/api test:e2e` (e2e setup migrates `offwise_test` via the CLI; the naming guard runs there).

## Data backfills

Generate the schema change first. Then either edit that generated migration's `up()` (e.g. add the column nullable → `UPDATE` → `SET NOT NULL`), or add a separate one with `migration:create <PascalName>` and write the SQL in it. Never invent a file name or timestamp for it.

## Spotting a hand-written migration

A CLI file is `<13-digit Date.now()>-<PascalName>.ts` with class `<PascalName><same digits>`. Round timestamps (`…00000`), timestamps that don't match the class, or a file nobody can regenerate are red flags: treat the migration as suspect, not as the pattern to copy.

## Replacing a migration

| Situation | Do |
| --- | --- |
| Not yet merged to `main` | `migration:revert` on the dev DB **and** on `offwise_test` (while the old file still exists), delete the file, regenerate with the CLI, then follow the workflow above. |
| Already on `main` | Never edit or delete it. Write a new migration that changes the schema forward. |

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Writing the file because the DB "is slow to start" | Start it; `generate` needs it. |
| Copying an existing file's name/timestamp pattern by hand | Use `migration:create` / `migration:generate`. |
| Deleting a migration that a DB already applied | Revert it in every DB first, or the next run fails on "already exists". |
| Leaving the generated raw SQL in place | Rewrite it with the schema API (workflow step 4); only the parts the API cannot express stay as `query()`. |
| Rewriting a constraint or index without its name | Copy the name from the generated SQL, or TypeORM picks a hashed one and the drift check fails. |
| Leaving a `Check` migration file behind | Delete it; it means entity and migrations disagree — fix the real migration. |
| Committing or staging the result | Don't. ADR 0004: leave changes unstaged for human review. |

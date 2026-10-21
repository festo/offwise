# @offwise/api

NestJS REST API for offwise, backed by PostgreSQL. Read the root `CLAUDE.md` first.

## Stack

NestJS, TypeScript, PostgreSQL, class-validator / class-transformer (request DTOs), zod (env config), Vitest + supertest (see `docs/decisions/0005-vitest-and-zod.md`). ORM: TypeORM (see `docs/decisions/0001-use-typeorm.md`).

## Commands

```bash
docker compose up -d db redis mailpit  # postgres, redis, mail catcher for local dev and e2e
pnpm --filter @offwise/api start:dev
pnpm --filter @offwise/api lint
pnpm --filter @offwise/api typecheck
pnpm --filter @offwise/api test         # unit
pnpm --filter @offwise/api test:e2e     # e2e against postgres
pnpm --filter @offwise/api migration:generate <Name>   # generate a migration from entity changes
pnpm --filter @offwise/api migration:run        # apply migrations
```

## Conventions

- One Nest module per domain area in `src/modules/<area>/` (kebab-case, e.g. `src/modules/leave-requests/`): `<area>.module.ts`, `.controller.ts`, `.service.ts`, `dto/`, `entities/`, with unit tests (`*.spec.ts`) next to the code.
- An area may add one `<area>-core.module.ts` next to its main module, holding only the services other modules or the install CLI need (e.g. `AuthCoreModule`, `UsersCoreModule`). It has no controllers or global guards and never imports its area's main module. Use it to avoid module cycles and to keep the CLI free of HTTP code; no other extra modules per area.
- Code used only by the install command (such as the first-admin bootstrap) lives in `src/install/` and is provided by `InstallCliModule`.
- Infrastructure that is not a domain feature stays directly under `src/`: `config/`, `database/`, `migrations/`, `install/`, `health/`, and `common/` for cross-cutting guards, interceptors, filters, pipes and decorators.
- Controllers are thin: they parse, validate, and delegate. Business rules live in services.
- Every request body and query uses a DTO class validated with class-validator; the global `ValidationPipe` uses `whitelist: true, forbidNonWhitelisted: true, transform: true`.
- Request/response contracts consumed by the web app are defined in `@offwise/shared`, and the DTOs implement them.
- The API owns all leave domain logic: balances, accrual, overlap checks, approvals, holidays. Dates are handled explicitly (date-only values for leave days, no accidental timezone shifts).
- Errors use Nest's HTTP exceptions with clear messages; never leak stack traces or SQL.
- Config comes from environment variables, validated at startup with the zod schema in `src/config/env.validation.ts`; no secrets in code. `.env*` files are gitignored.

## Database

- TypeORM through `@nestjs/typeorm`. Entities live in `src/modules/<area>/entities/<name>.entity.ts` (infrastructure entities such as the install-step record live with their infrastructure module).
- Migrations are generated and run with the TypeORM CLI against a single data-source file (`src/data-source.ts`) and stored in `src/migrations/`.
  `migration:generate` wraps `typeorm migration:generate -d src/data-source.ts src/migrations/<Name>`; `migration:run` wraps `typeorm migration:run -d src/data-source.ts` (TypeScript data source run via ts-node/tsx).
- Entities are listed explicitly: register every new entity in `src/database/entities.ts`. Migrations are discovered by glob from `src/migrations/`, and only `src/data-source.ts` passes them to `buildDataSourceOptions`. The API never runs or checks migrations (ADR 0006); run `migration:run` (or `migration:run:dist` against a build) before starting it.
- Defaults a module seeds once per installation are install steps (ADR 0003): implement `InstallStep` from `src/install/install-step.ts` next to the module and append it to `src/install/install-steps.registry.ts`. Step names are permanent. Steps run only through the install command — `install:run` (or `install:run:dist` against a build) — never in the API (ADR 0006).
- E2E tests run against the `offwise_test` database (created by `docker/postgres/init`) and refuse any database whose name does not end in `_test`; use `createTestApp()`, `resetDatabase()` and `runApiCli()` (CLI commands as a child process) from `test/utils/`.
- `TypeOrmModule` and `src/data-source.ts` share one options builder, so entities and connection settings never drift.
- `synchronize: false` always.
- UUID primary keys use `gen_random_uuid()` (`uuidExtension: 'pgcrypto'`, `installExtensions: false`); never add a DB extension at runtime.
- Every table and column name is snake_case. `SnakeNamingStrategy` (`src/database/snake-naming.strategy.ts`) derives names from class and property names, so don't add `name:` overrides just to get snake_case; any explicit name must itself be snake_case. Hand-written migration SQL follows the same rule. `test/naming-convention.e2e-spec.ts` fails on any violation in the migrated schema.
- No database enums (`CREATE TYPE ... AS ENUM`, `type: 'enum'`): store enum-like values as `varchar` and define the allowed values in code (a `const` array in `@offwise/shared`, validated with `@IsIn`).
- Leave dates use `type: 'date'` columns (they come back as `YYYY-MM-DD` strings), never `timestamp`.
- For any migration work, follow `.claude/skills/typeorm-migrations/SKILL.md`.
- Every schema change ships with a migration in the same PR.
- No destructive migration (drop or rename of a column or table, data rewrite) without explicit human approval in the PR.

## Tests

- Unit tests (`*.spec.ts`) for services and domain rules; cover the edge cases of leave logic (overlaps, boundaries, half days, year rollover).
- E2E tests (`test/*.e2e-spec.ts`) with supertest against the real Postgres from docker compose for every endpoint's happy path and main failure paths.

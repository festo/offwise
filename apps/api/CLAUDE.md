# @offwise/api

NestJS REST API for offwise, backed by PostgreSQL. Read the root `CLAUDE.md` first.

## Stack

NestJS, TypeScript, PostgreSQL, class-validator / class-transformer, Jest + supertest. ORM: TypeORM (see `docs/decisions/0001-use-typeorm.md`).

## Commands (once scaffolded)

```bash
docker compose up -d db                 # postgres for local dev and e2e
pnpm --filter @offwise/api start:dev
pnpm --filter @offwise/api lint
pnpm --filter @offwise/api typecheck
pnpm --filter @offwise/api test         # unit
pnpm --filter @offwise/api test:e2e     # e2e against postgres
pnpm --filter @offwise/api migration:generate <Name>   # generate a migration from entity changes
pnpm --filter @offwise/api migration:run        # apply migrations
```

## Conventions

- One Nest module per domain area (`src/<area>/`: `<area>.module.ts`, `.controller.ts`, `.service.ts`, `dto/`).
- Controllers are thin: they parse, validate, and delegate. Business rules live in services.
- Every request body and query uses a DTO class validated with class-validator; the global `ValidationPipe` uses `whitelist: true, forbidNonWhitelisted: true, transform: true`.
- Request/response contracts consumed by the web app are defined in `@offwise/shared`, and the DTOs implement them.
- The API owns all leave domain logic: balances, accrual, overlap checks, approvals, holidays. Dates are handled explicitly (date-only values for leave days, no accidental timezone shifts).
- Errors use Nest's HTTP exceptions with clear messages; never leak stack traces or SQL.
- Config comes from environment variables (validated at startup); no secrets in code. `.env*` files are gitignored.

## Database

- TypeORM through `@nestjs/typeorm`. Entities live in `src/<area>/entities/<name>.entity.ts`.
- Migrations are generated and run with the TypeORM CLI against a single data-source file (`src/data-source.ts`) and stored in `src/migrations/`.
  `migration:generate` wraps `typeorm migration:generate -d src/data-source.ts src/migrations/<Name>`; `migration:run` wraps `typeorm migration:run -d src/data-source.ts` (TypeScript data source run via ts-node/tsx).
- `TypeOrmModule` and `src/data-source.ts` share one options object, so entities, migrations, and connection settings never drift.
- `synchronize: false` always.
- Leave dates use `type: 'date'` columns (they come back as `YYYY-MM-DD` strings), never `timestamp`.
- Every schema change ships with a migration in the same PR.
- No destructive migration (drop or rename of a column or table, data rewrite) without explicit human approval in the PR.

## Tests

- Unit tests (`*.spec.ts`) for services and domain rules; cover the edge cases of leave logic (overlaps, boundaries, half days, year rollover).
- E2E tests (`test/*.e2e-spec.ts`) with supertest against the real Postgres from docker compose for every endpoint's happy path and main failure paths.

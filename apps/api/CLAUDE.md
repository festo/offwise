# @offwise/api

NestJS REST API for offwise, backed by PostgreSQL. Read the root `CLAUDE.md` first.

## Stack

NestJS, TypeScript, PostgreSQL, class-validator / class-transformer, Jest + supertest. ORM: **not decided yet**. Check `docs/decisions/` and don't introduce one without an ADR.

## Commands (once scaffolded)

```bash
docker compose up -d db                 # postgres for local dev and e2e
pnpm --filter @offwise/api start:dev
pnpm --filter @offwise/api lint
pnpm --filter @offwise/api typecheck
pnpm --filter @offwise/api test         # unit
pnpm --filter @offwise/api test:e2e     # e2e against postgres
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

- Every schema change ships with a migration in the same PR.
- No destructive migration (drop or rename of a column or table, data rewrite) without explicit human approval in the PR.

## Tests

- Unit tests (`*.spec.ts`) for services and domain rules; cover the edge cases of leave logic (overlaps, boundaries, half days, year rollover).
- E2E tests (`test/*.e2e-spec.ts`) with supertest against the real Postgres from docker compose for every endpoint's happy path and main failure paths.

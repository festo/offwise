# 0001: Use TypeORM

**Status:** Accepted
**Date:** 2026-10-13

## Context
The NestJS API runs on PostgreSQL and needs an ORM and a migration workflow.

## Decision
Use TypeORM through `@nestjs/typeorm`.

## Consequences
- Entities are decorated classes.
- Migrations are generated and run with the TypeORM CLI.
- `synchronize: false` everywhere; the schema changes only through migrations.
- E2E test-data isolation still has to be designed during scaffolding (e.g. a dedicated test database, with migrations run and tables truncated between suites).

# 0001: Use TypeORM

**Status:** Accepted
**Date:** 2026-10-13
**Updated:** 2026-10-14

## Context
The NestJS API runs on PostgreSQL and needs an ORM and a migration workflow.

## Decision
Use TypeORM through `@nestjs/typeorm`.

## Consequences
- Entities are decorated classes.
- Migrations are generated and run with the TypeORM CLI.
- `synchronize: false` everywhere; the schema changes only through migrations.
- E2E tests run against a dedicated `offwise_test` database (created by `docker/postgres/init`): the e2e global setup migrates it through the CLI, and tests truncate tables with `resetDatabase()`. The test helpers refuse any database whose name does not end in `_test`.

# 0005: Vitest for all tests, zod for config validation

**Status:** Accepted
**Date:** 2026-10-13

## Context
The web app and `@offwise/shared` already test with Vitest; the API was planned with Jest. Two test runners mean two configs, two mocking APIs and two sets of habits. Environment validation was planned with class-validator, which needs classes, decorators and `reflect-metadata` for what is a flat schema of strings.

## Decision
- Use **Vitest** in every workspace, including the API. The API compiles tests with SWC through `unplugin-swc`, because NestJS dependency injection relies on `emitDecoratorMetadata`, which Vitest's default esbuild transform does not emit. The API has one `vitest.config.mts` with a `unit` project (`src/**/*.spec.ts`) and an `e2e` project (`test/**/*.e2e-spec.ts`, run one file at a time against the test database). Test files import `describe`, `it`, `expect` and `vi` from `vitest` explicitly.
- Use **zod** for environment validation (`apps/api/src/config/env.validation.ts`). The schema is the single source of the env type (`z.infer`).
- Request DTOs stay on **class-validator** with the global `ValidationPipe`, as `apps/api/CLAUDE.md` requires.

## Consequences
- One test runner and mocking API (`vi`) across the repo; Jest, ts-jest and `@types/jest` are not used.
- The API's test transform (SWC) differs from its build (`tsc` via `nest build`); a decorator or emit difference between them would show up only in one. The e2e suite against the built-in Nest test module covers the DI wiring.
- Two validation libraries exist side by side (zod for config, class-validator for DTOs). Moving DTOs to zod would be a separate decision.

# Module 0: Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable, empty offwise monorepo: NestJS API with validated env, TypeORM migrations, an install-step runner and a health endpoint; a Vue 3 web app with Tailwind, shadcn-vue, vue-i18n and Storybook that shows the API status; and `docker compose up` running the whole stack.

**Architecture:** Plain pnpm workspaces with `apps/api`, `apps/web` and `packages/shared`. The API validates env with class-validator at startup, shares one TypeORM options builder between Nest and the TypeORM CLI, never runs migrations itself (it refuses to start while migrations are pending), and runs pending install steps on boot. The web app talks to `/api` on its own origin (Vite proxy in dev, nginx in compose). Spec: `docs/specs/2026-10-13-configuration-and-modules-design.md`, ADRs 0001–0003.

**Tech Stack:** Node 24, pnpm 10, TypeScript ~5.9, NestJS 11, TypeORM 0.3, PostgreSQL 17, Vitest 3 (API via unplugin-swc) + supertest, zod 4 (env validation), Vue 3.5, Vite 6, Tailwind 4, shadcn-vue, vue-i18n 11, Vitest 3, Storybook 9, Docker Compose, nginx.

## Global Constraints

- Work on branch `feat/scaffolding`. Never commit to `main`.
- ADR 0004: implementers never stage, unstage or commit. Each task ends by handing an unstaged working tree to a human; the coordinating session commits only what the human has staged.
- End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (after a blank line).
- Every workspace defines `lint`, `typecheck`, `test`, `format`. The api also defines `test:e2e`, `migration:generate`, `migration:run`. The web app also defines `storybook`, `build-storybook`.
- The compose service for PostgreSQL is named `db`.
- Add dependencies to the workspace that uses them (`pnpm --filter <pkg> add <dep>`). The root holds repo tooling only (`prettier`, `typescript`).
- Tests use Vitest everywhere (ADR 0005). The API compiles tests with SWC (`unplugin-swc`) because Nest dependency injection needs decorator metadata, which esbuild does not emit. Test files import `describe`/`it`/`expect`/`vi` from `vitest` explicitly (no globals).
- Env validation uses zod (ADR 0005); request DTOs keep class-validator.
- Configs must be clean under TypeScript 6 (the editor's version): no `moduleResolution: node`/`node10`, no `baseUrl`, `rootDir` set wherever `outDir` is. ESLint configs use `defineConfig` from `eslint/config`, not the deprecated `tseslint.config()`.
- Module 0 env vars only: `NODE_ENV`, `PORT` (default 3000), `LOG_LEVEL` (default `info`), `DATABASE_URL`. Validated at startup; invalid config stops the process. Documented in `apps/api/.env.example`.
- The API never runs migrations automatically. Migrations run only through an explicit command: `migration:run` (dev, TypeScript) or `migration:run:dist` / `docker compose run --rm migrate` (built code). On startup the API checks for pending migrations and refuses to start if there are any.
- TypeORM: `synchronize: false` always; `migrationsRun` is never set; data source file is `apps/api/src/data-source.ts`; migrations live in `apps/api/src/migrations/`; Nest and the CLI share one options builder.
- The web app has no runtime env; it calls `/api` on its own origin.
- Workspace `format` scripts run Prettier from the workspace directory, so they pass the root `.gitignore` and `.prettierignore` explicitly with `--ignore-path`.
- vue-i18n is wired with English only; every user-visible string goes through `t()`.
- Leave dates and domain logic are out of scope for this module.

## Agent routing

Tasks 1–4 and 7 → `backend` agent. Tasks 5–6 → `frontend` agent.

## File structure

```
package.json, pnpm-workspace.yaml, pnpm-lock.yaml   root workspace + repo tooling
tsconfig.base.json, .prettierrc, .prettierignore, .editorconfig, .nvmrc, .dockerignore
docker-compose.yml                                  db, mailpit, api, web
docker/postgres/init/01-create-test-db.sql          creates offwise_test for e2e

packages/shared/
  src/index.ts          barrel
  src/api.ts            API_PREFIX constant
  src/health.ts         HealthResponse contract

apps/api/
  .env.example
  Dockerfile
  src/main.ts                       bootstrap (dotenv → validate env → Nest)
  src/app.module.ts                 root module
  src/app.setup.ts                  configureApp(): prefix + ValidationPipe (shared with e2e)
  src/config/env.validation.ts      zod envSchema, EnvironmentVariables + validateEnv()
  src/config/log-levels.ts          LOG_LEVEL → Nest logger levels
  src/database/typeorm-options.ts   buildDataSourceOptions() — the one options object
  src/database/entities.ts          explicit entity list
  src/database/database.module.ts   TypeOrmModule.forRootAsync + pending-migration check on init
  src/database/pending-migrations.ts findPendingMigrations()
  src/migrations/index.ts           explicit migration list
  src/migrations/1760313600000-CreateInstallSteps.ts
  src/data-source.ts                TypeORM CLI data source
  src/migrate.ts                    explicit migration command for built code (containers)
  src/health/                       GET /api/health
  src/install/                      install-step contract, record entity, runner, registry, module
  vitest.config.mts                 unit + e2e Vitest projects (SWC)
  test/                             e2e env, global setup, helpers, specs

apps/web/
  Dockerfile, nginx.conf, index.html, vite.config.ts, components.json
  .storybook/main.ts, .storybook/preview.ts
  src/main.ts, src/App.vue, src/router/index.ts
  src/i18n/index.ts, src/i18n/locales/en.json
  src/assets/main.css               Tailwind + shadcn theme tokens
  src/lib/utils.ts                  shadcn cn()
  src/lib/api.ts                    apiGet() + ApiError
  src/components/ui/badge/          shadcn-vue Badge (generated)
  src/features/system/types.ts
  src/features/system/composables/useHealth.ts
  src/features/system/components/ApiStatus.vue (+ .spec.ts, .stories.ts)
  src/pages/HomePage.vue
```

---

### Task 1: Root workspace and `@offwise/shared`

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc`, `.prettierignore`, `.editorconfig`, `.nvmrc`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/tsconfig.build.json`, `packages/shared/eslint.config.mjs`, `packages/shared/src/index.ts`, `packages/shared/src/api.ts`, `packages/shared/src/health.ts`

**Interfaces:**
- Produces: `API_PREFIX = 'api'` and `interface HealthResponse { status: 'ok' | 'error'; db: 'up' | 'down' }` exported from `@offwise/shared`. Built CommonJS output in `packages/shared/dist` (`main: dist/index.js`, `types: dist/index.d.ts`), rebuilt by the root `postinstall`.

- [ ] **Step 1: Pin the toolchain**

```bash
cat > .nvmrc <<'EOF'
24
EOF
corepack enable
corepack use pnpm@10
```

`corepack use` writes the exact `packageManager` field into `package.json` (it creates the file if missing). Then make `package.json` look like this, keeping the `packageManager` value corepack wrote:

```json
{
  "name": "offwise",
  "private": true,
  "packageManager": "pnpm@10.x.y",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "postinstall": "pnpm --filter @offwise/shared build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "format": "pnpm -r format",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 2: Workspace and shared config files**

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true
  }
}
```

`.prettierrc`:

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

`.prettierignore`:

```
pnpm-lock.yaml
**/dist
**/coverage
**/storybook-static
```

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 3: Shared package files**

`packages/shared/package.json`:

```json
{
  "name": "@offwise/shared",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run --passWithNoTests",
    "format": "prettier --write . --ignore-path ../../.gitignore --ignore-path ../../.prettierignore"
  }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "noEmit": true
  },
  "include": ["src"]
}
```

`packages/shared/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

`packages/shared/eslint.config.mjs`:

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
```

`packages/shared/src/api.ts`:

```ts
/** Path prefix of every API route; the web app calls `/${API_PREFIX}/...` on its own origin. */
export const API_PREFIX = 'api';
```

`packages/shared/src/health.ts`:

```ts
/** Response of `GET /api/health`. */
export interface HealthResponse {
  status: 'ok' | 'error';
  db: 'up' | 'down';
}
```

`packages/shared/src/index.ts`:

```ts
export * from './api';
export * from './health';
```

- [ ] **Step 4: Install tooling**

```bash
pnpm add -Dw prettier@^3 typescript@~5.9
pnpm --filter @offwise/shared add -D typescript@~5.9 eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-config-prettier@^10 vitest@^3
```

Expected: install succeeds and the root `postinstall` builds shared. If pnpm prints "Ignored build scripts" for dependencies, that is fine at this stage.

- [ ] **Step 5: Verify**

```bash
pnpm install
ls packages/shared/dist
pnpm -r lint && pnpm -r typecheck && pnpm -r test && pnpm format:check
```

Expected: `dist` contains `index.js`, `index.d.ts`, `api.js`, `health.js`; all four commands exit 0 (vitest prints "No test files found, exiting with code 0"). If `format:check` fails, run `pnpm prettier --write .` once and re-check.

- [ ] **Step 6: Hand over for human review (ADR 0004)**

Do not stage or commit. Report the changed files (`git status --short`) and the verification results, and stop. After the human has reviewed and staged the changes, the coordinating session commits exactly what is staged:

```bash
git commit -m "chore: set up pnpm workspace and @offwise/shared" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: API skeleton with validated env

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/nest-cli.json`, `apps/api/eslint.config.mjs`, `apps/api/vitest.config.mts`
- Create: `apps/api/src/config/env.validation.ts`, `apps/api/src/config/log-levels.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app.setup.ts`, `apps/api/src/main.ts`
- Test: `apps/api/src/config/env.validation.spec.ts`, `apps/api/src/config/log-levels.spec.ts`

**Interfaces:**
- Consumes: `API_PREFIX` from `@offwise/shared`.
- Produces:
  - `NODE_ENVS`, `LOG_LEVELS` (readonly tuples), `envSchema` (zod object; Task 3 adds `DATABASE_URL`)
  - `type EnvironmentVariables = z.infer<typeof envSchema>` — `{ NODE_ENV: 'development' | 'test' | 'production'; PORT: number; LOG_LEVEL: LogLevel }`
  - `type LogLevel = 'error' | 'warn' | 'info' | 'debug'`
  - `validateEnv(config: Record<string, unknown>): EnvironmentVariables` — throws `Error('Invalid environment configuration: <path>: <message>; ...')`; unknown keys are dropped
  - `toNestLogLevels(level: LogLevel): NestLogLevel[]`
  - `configureApp(app: INestApplication): void` — sets the `api` prefix and the global `ValidationPipe`
  - `AppModule`
  - `apps/api/vitest.config.mts` with a `unit` project (`src/**/*.spec.ts`); Task 3 adds an `e2e` project

- [ ] **Step 1: Package and tooling files**

`apps/api/package.json`:

```json
{
  "name": "@offwise/api",
  "version": "0.0.0",
  "private": true,
  "files": ["dist"],
  "scripts": {
    "build": "pnpm --filter @offwise/shared build && nest build",
    "start": "node dist/main.js",
    "start:dev": "pnpm --filter @offwise/shared build && nest start --watch",
    "lint": "eslint .",
    "typecheck": "pnpm --filter @offwise/shared build && tsc -p tsconfig.json",
    "test": "vitest run --project unit",
    "format": "prettier --write . --ignore-path ../../.gitignore --ignore-path ../../.prettierignore"
  }
}
```

`apps/api/tsconfig.json` (typecheck only; never emits):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test", "vitest.config.mts"]
}
```

`apps/api/tsconfig.build.json` (what `nest build` compiles):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.spec.ts"]
}
```

The package has no `"type": "module"`, so `nodenext` compiles `src` to CommonJS (what Nest expects) and relative imports need no file extensions.

`apps/api/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "tsConfigPath": "tsconfig.build.json", "deleteOutDir": true }
}
```

`apps/api/eslint.config.mjs`:

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  { languageOptions: { globals: globals.node } },
);
```

`apps/api/vitest.config.mts`:

```ts
import { fileURLToPath, URL } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC instead of esbuild: Nest dependency injection needs emitDecoratorMetadata.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      // Tests use the shared source, so they never depend on a stale packages/shared/dist.
      '@offwise/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    projects: [{ extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } }],
  },
});
```

Install:

```bash
pnpm --filter @offwise/api add @offwise/shared@workspace:* @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11 @nestjs/config@^4 class-validator class-transformer reflect-metadata rxjs dotenv zod@^4
pnpm --filter @offwise/api add -D @nestjs/cli@^11 @nestjs/schematics@^11 @nestjs/testing@^11 typescript@~5.9 @types/node@^24 vitest@^3.2 unplugin-swc @swc/core supertest @types/supertest eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-config-prettier@^10 globals
```

(`class-validator`/`class-transformer` are for request DTOs and the global `ValidationPipe`, not for env.) If pnpm reports ignored build scripts for `@swc/core`, check `pnpm --filter @offwise/api test` still runs; SWC ships its binary as an optional dependency.

- [ ] **Step 2: Write the failing tests**

`apps/api/src/config/env.validation.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv({ NODE_ENV: 'test' });
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('converts PORT from a string', () => {
    expect(validateEnv({ NODE_ENV: 'production', PORT: '8080' }).PORT).toBe(8080);
  });

  it('drops variables it does not know', () => {
    expect(validateEnv({ NODE_ENV: 'test', PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });

  it('rejects a missing NODE_ENV with a prefixed message naming the variable', () => {
    expect(() => validateEnv({})).toThrow(/^Invalid environment configuration: .*NODE_ENV/);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', PORT: '70000' })).toThrow(/PORT/);
  });
});
```

`apps/api/src/config/log-levels.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toNestLogLevels } from './log-levels';

describe('toNestLogLevels', () => {
  it('maps error to fatal and error only', () => {
    expect(toNestLogLevels('error')).toEqual(['fatal', 'error']);
  });

  it('maps warn to fatal, error and warn', () => {
    expect(toNestLogLevels('warn')).toEqual(['fatal', 'error', 'warn']);
  });

  it('maps info to Nest "log" and everything more severe', () => {
    expect(toNestLogLevels('info')).toEqual(['fatal', 'error', 'warn', 'log']);
  });

  it('includes debug but not verbose for debug', () => {
    expect(toNestLogLevels('debug')).toEqual(['fatal', 'error', 'warn', 'log', 'debug']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @offwise/api test`
Expected: FAIL — `./env.validation` and `./log-levels` cannot be resolved.

- [ ] **Step 4: Implement**

`apps/api/src/config/env.validation.ts`:

```ts
import { z } from 'zod';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;
export type LogLevel = EnvironmentVariables['LOG_LEVEL'];

/** Validates and normalises process.env-like input; unknown variables are dropped. */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}
```

`apps/api/src/config/log-levels.ts`:

```ts
import type { LogLevel as NestLogLevel } from '@nestjs/common';
import type { LogLevel } from './env.validation';

const SEVERITY_ORDER: NestLogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

const NEST_LEVEL: Record<LogLevel, NestLogLevel> = {
  error: 'error',
  warn: 'warn',
  info: 'log',
  debug: 'debug',
};

/** Nest enables an explicit list of levels; return the chosen level and everything more severe. */
export function toNestLogLevels(level: LogLevel): NestLogLevel[] {
  return SEVERITY_ORDER.slice(0, SEVERITY_ORDER.indexOf(NEST_LEVEL[level]) + 1);
}
```

`apps/api/src/app.setup.ts`:

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { API_PREFIX } from '@offwise/shared';

/** App-wide wiring shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
```

`apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // .env is loaded by dotenv in main.ts / data-source.ts; e2e tests set process.env directly.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
  ],
})
export class AppModule {}
```

`apps/api/src/main.ts`:

```ts
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { validateEnv } from './config/env.validation';
import { toNestLogLevels } from './config/log-levels';

async function bootstrap(): Promise<void> {
  // Validated here too (not only in ConfigModule) because PORT and LOG_LEVEL are needed before Nest starts.
  const env = validateEnv(process.env);
  const app = await NestFactory.create(AppModule, { logger: toNestLogLevels(env.LOG_LEVEL) });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

void bootstrap();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @offwise/api test`
Expected: PASS, 10 tests, no warnings in the output.

- [ ] **Step 6: Verify lint, typecheck and boot**

```bash
pnpm --filter @offwise/api lint
pnpm --filter @offwise/api typecheck
pnpm --filter @offwise/api build && ls apps/api/dist/main.js
(cd apps/api && NODE_ENV=development PORT=3999 node dist/main.js & sleep 4; kill %1)
(cd apps/api && node dist/main.js; true)
```

Expected: lint and typecheck exit 0 with no deprecation warnings; `dist/main.js` exists (not `dist/src/main.js`). The first boot logs `Nest application successfully started`. The second (no `NODE_ENV`) exits with `Invalid environment configuration: NODE_ENV: ...`.

- [ ] **Step 7: Hand over for human review (ADR 0004)**

Do not stage or commit. Report the changed files (`git status --short`) and the verification results, and stop. After the human has reviewed and staged the changes, the coordinating session commits exactly what is staged:

```bash
git commit -m "feat(api): scaffold NestJS app with validated env" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Database, migrations, e2e harness and health endpoint

**Files:**
- Create: `docker-compose.yml`, `docker/postgres/init/01-create-test-db.sql`, `apps/api/.env.example`
- Modify: `apps/api/src/config/env.validation.ts`, `apps/api/src/config/env.validation.spec.ts`, `apps/api/src/app.module.ts`, `apps/api/package.json`
- Create: `apps/api/src/database/typeorm-options.ts`, `apps/api/src/database/entities.ts`, `apps/api/src/database/database.module.ts`, `apps/api/src/database/pending-migrations.ts`, `apps/api/src/migrations/index.ts`, `apps/api/src/data-source.ts`, `apps/api/src/migrate.ts`
- Create: `apps/api/src/health/health.service.ts`, `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.module.ts`
- Modify: `apps/api/vitest.config.mts` (add `e2e` project)
- Create: `apps/api/test/test-env.ts`, `apps/api/test/setup-env.ts`, `apps/api/test/global-setup.ts`, `apps/api/test/utils/create-test-app.ts`, `apps/api/test/utils/reset-database.ts`
- Test: `apps/api/src/health/health.service.spec.ts`, `apps/api/test/health.e2e-spec.ts`, `apps/api/test/pending-migrations.e2e-spec.ts`

**Interfaces:**
- Consumes: `validateEnv`, `configureApp`, `AppModule` (Task 2); `HealthResponse` (Task 1).
- Produces:
  - `envSchema` gains `DATABASE_URL: string` (so `EnvironmentVariables.DATABASE_URL: string`)
  - `buildDataSourceOptions(databaseUrl: string): DataSourceOptions`
  - `entities: DataSourceOptions['entities']` (array) in `src/database/entities.ts`; `migrations: DataSourceOptions['migrations']` (array) in `src/migrations/index.ts`
  - `findPendingMigrations(dataSource: DataSource): Promise<string[]>` — names of known migrations not yet applied
  - `DatabaseModule` — throws on module init if migrations are pending
  - `HealthModule`, `HealthService.check(): Promise<HealthResponse>`
  - Test helpers: `createTestApp(): Promise<INestApplication>`, `resetDatabase(dataSource: DataSource): Promise<void>`, `applyTestEnv(): void`, `TEST_DATABASE_URL`

- [ ] **Step 1: Postgres for dev and e2e**

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: offwise
      POSTGRES_PASSWORD: offwise
      POSTGRES_DB: offwise
    ports:
      - '5432:5432'
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U offwise -d offwise']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  db-data: {}
```

`docker/postgres/init/01-create-test-db.sql`:

```sql
-- Separate database for API e2e tests; runs only when the volume is first created.
CREATE DATABASE offwise_test;
```

`apps/api/.env.example`:

```bash
# Copy to apps/api/.env for local development. Every variable is validated at startup.
NODE_ENV=development
PORT=3000
# error | warn | info | debug
LOG_LEVEL=debug
DATABASE_URL=postgresql://offwise:offwise@localhost:5432/offwise
```

```bash
docker compose up -d db
cp apps/api/.env.example apps/api/.env
docker compose exec db psql -U offwise -l | grep offwise_test
```

Expected: `offwise_test` is listed. If the volume existed before, run `docker compose down -v` and start again.

- [ ] **Step 2: Failing test for DATABASE_URL**

Add `DATABASE_URL` to every existing `validateEnv({...})` call in `env.validation.spec.ts` (use `const DB = 'postgresql://u:p@localhost:5432/x';` at the top and spread `{ NODE_ENV: 'test', DATABASE_URL: DB }`), except the missing-NODE_ENV test, which stays `validateEnv({})`. Then append:

```ts
  it('requires DATABASE_URL to be a postgres connection string', () => {
    expect(() => validateEnv({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ NODE_ENV: 'test', DATABASE_URL: 'mysql://x' })).toThrow(
      /DATABASE_URL/,
    );
    expect(validateEnv({ NODE_ENV: 'test', DATABASE_URL: DB }).DATABASE_URL).toBe(DB);
  });
```

Run: `pnpm --filter @offwise/api test`
Expected: FAIL in the new test (no `DATABASE_URL` validation yet).

- [ ] **Step 3: Add DATABASE_URL**

In `env.validation.ts`, add to the `envSchema` object:

```ts
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, 'must be a postgres:// connection string'),
```

Run: `pnpm --filter @offwise/api test`
Expected: PASS.

- [ ] **Step 4: TypeORM options, data source, migration scripts**

```bash
pnpm --filter @offwise/api add typeorm@^0.3 @nestjs/typeorm@^11 pg
pnpm --filter @offwise/api add -D ts-node
```

`apps/api/src/database/entities.ts`:

```ts
import type { DataSourceOptions } from 'typeorm';

/** Every TypeORM entity. Add new entities here; Nest and the TypeORM CLI both read this list. */
export const entities: DataSourceOptions['entities'] = [];
```

`apps/api/src/migrations/index.ts`:

```ts
import type { DataSourceOptions } from 'typeorm';

/** Every migration, oldest first. After `migration:generate`, add the new class here. */
export const migrations: DataSourceOptions['migrations'] = [];
```

`apps/api/src/database/typeorm-options.ts`:

```ts
import type { DataSourceOptions } from 'typeorm';
import { migrations } from '../migrations';
import { entities } from './entities';

/** The single options object shared by TypeOrmModule and the CLI data source. */
export function buildDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities,
    migrations,
    migrationsTableName: 'migrations',
    // Never migrate on startup; migrations run only through an explicit command.
    synchronize: false,
  };
}
```

`apps/api/src/data-source.ts`:

```ts
import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/typeorm-options';

export default new DataSource(buildDataSourceOptions(validateEnv(process.env).DATABASE_URL));
```

`apps/api/src/database/database.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { buildDataSourceOptions } from './typeorm-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
    }),
  ],
})
export class DatabaseModule {}
```

Add to `apps/api/package.json` `scripts`:

```json
    "test:e2e": "vitest run --project e2e",
    "migration:generate": "sh -c 'typeorm-ts-node-commonjs -d src/data-source.ts migration:generate src/migrations/$0'",
    "migration:run": "typeorm-ts-node-commonjs -d src/data-source.ts migration:run",
    "migration:revert": "typeorm-ts-node-commonjs -d src/data-source.ts migration:revert",
    "migration:run:dist": "node dist/migrate.js"
```

`apps/api/src/migrate.ts` (the explicit migration command for built code, used by containers):

```ts
import 'reflect-metadata';
import 'dotenv/config';
import dataSource from './data-source';

async function migrate(): Promise<void> {
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length === 0
        ? 'No pending migrations.'
        : `Applied migrations: ${applied.map((migration) => migration.name).join(', ')}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

migrate().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

(`sh -c '...' Name` binds the name argument pnpm appends to `$0`, so `pnpm --filter @offwise/api migration:generate AddUsers` writes `src/migrations/<timestamp>-AddUsers.ts`.)

Verify: `pnpm --filter @offwise/api migration:run`
Expected: `No migrations are pending` (and the `migrations` table now exists in `offwise`). This command is the only way migrations run in development.

- [ ] **Step 5: Failing unit test for HealthService**

`apps/api/src/health/health.service.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { HealthService } from './health.service';

function serviceWith(query: Mock): HealthService {
  return new HealthService({ query } as unknown as DataSource);
}

describe('HealthService', () => {
  it('reports ok when the database answers', async () => {
    const query = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    await expect(serviceWith(query).check()).resolves.toEqual({ status: 'ok', db: 'up' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports error when the database query fails', async () => {
    const query = vi.fn().mockRejectedValue(new Error('connection refused'));
    await expect(serviceWith(query).check()).resolves.toEqual({ status: 'error', db: 'down' });
  });
});
```

Run: `pnpm --filter @offwise/api test`
Expected: FAIL — `Cannot find module './health.service'`.

- [ ] **Step 6: Implement health**

`apps/api/src/health/health.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@offwise/shared';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'up' };
    } catch {
      return { status: 'error', db: 'down' };
    }
  }
}
```

`apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { HealthResponse } from '@offwise/shared';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async get(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    if (result.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
```

`apps/api/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({ controllers: [HealthController], providers: [HealthService] })
export class HealthModule {}
```

`apps/api/src/app.module.ts` — add the two modules:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // .env is loaded by dotenv in main.ts / data-source.ts; e2e tests set process.env directly.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
```

If `express` types are missing, `pnpm --filter @offwise/api add -D @types/express`.

Run: `pnpm --filter @offwise/api test`
Expected: PASS.

- [ ] **Step 7: E2E harness and failing e2e test**

`apps/api/test/test-env.ts`:

```ts
/** E2E tests always use the dedicated test database, never the dev database. */
export const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://offwise:offwise@localhost:5432/offwise_test';

export function applyTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL ??= 'error';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
```

`apps/api/test/setup-env.ts`:

```ts
import { applyTestEnv } from './test-env';

applyTestEnv();
```

`apps/api/test/global-setup.ts`:

```ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/database/typeorm-options';
import { applyTestEnv, TEST_DATABASE_URL } from './test-env';

/** Runs once before all e2e suites: bring the test database schema up to date. */
export default async function globalSetup(): Promise<void> {
  applyTestEnv();
  const dataSource = new DataSource(buildDataSourceOptions(TEST_DATABASE_URL));
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
```

`apps/api/test/utils/create-test-app.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}
```

`apps/api/test/utils/reset-database.ts`:

```ts
import type { DataSource } from 'typeorm';

/** Empties every entity table (not the migrations table). Call in beforeEach of suites that write. */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  const tables = dataSource.entityMetadatas.map((metadata) => `"${metadata.tableName}"`);
  if (tables.length === 0) return;
  await dataSource.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}
```

Add the `e2e` project to `test.projects` in `apps/api/vitest.config.mts` (after the `unit` entry):

```ts
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          setupFiles: ['test/setup-env.ts'],
          globalSetup: ['test/global-setup.ts'],
          // One shared test database: run e2e files one at a time.
          fileParallelism: false,
        },
      },
```

`apps/api/test/health.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/create-test-app';

describe('GET /api/health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports ok when the database is reachable', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', db: 'up' });
  });
});
```

To see the e2e test fail first, temporarily remove `HealthModule` from `AppModule` imports and run `pnpm --filter @offwise/api test:e2e` — Expected: FAIL with `expected 200 "OK", got 404 "Not Found"`. Restore the import.

Next, the startup check for pending migrations. `apps/api/test/pending-migrations.e2e-spec.ts`:

```ts
import 'reflect-metadata';
import { DataSource, type MigrationInterface } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from '../src/database/typeorm-options';
import { findPendingMigrations } from '../src/database/pending-migrations';
import { TEST_DATABASE_URL } from './test-env';

class NotYetApplied9999999999999 implements MigrationInterface {
  name = 'NotYetApplied9999999999999';
  async up(): Promise<void> {}
  async down(): Promise<void> {}
}

async function withDataSource<T>(
  extraMigrations: (new () => MigrationInterface)[],
  fn: (dataSource: DataSource) => Promise<T>,
): Promise<T> {
  const options = buildDataSourceOptions(TEST_DATABASE_URL);
  const known = (options.migrations ?? []) as (new () => MigrationInterface)[];
  const dataSource = new DataSource({ ...options, migrations: [...known, ...extraMigrations] });
  await dataSource.initialize();
  try {
    return await fn(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

describe('findPendingMigrations (e2e)', () => {
  it('returns nothing for a fully migrated database', async () => {
    await expect(withDataSource([], findPendingMigrations)).resolves.toEqual([]);
  });

  it('returns migrations that have not been applied, without applying them', async () => {
    await withDataSource([NotYetApplied9999999999999], async (dataSource) => {
      await expect(findPendingMigrations(dataSource)).resolves.toEqual([
        'NotYetApplied9999999999999',
      ]);
      await expect(findPendingMigrations(dataSource)).resolves.toEqual([
        'NotYetApplied9999999999999',
      ]);
    });
  });
});
```

Run: `pnpm --filter @offwise/api test:e2e`
Expected: FAIL — `../src/database/pending-migrations` cannot be resolved.

`apps/api/src/database/pending-migrations.ts`:

```ts
import type { DataSource } from 'typeorm';

/** Names of known migrations not yet recorded in the migrations table. Read-only: never migrates. */
export async function findPendingMigrations(dataSource: DataSource): Promise<string[]> {
  const known = dataSource.migrations.map((migration) => migration.name ?? migration.constructor.name);
  const table = dataSource.options.migrationsTableName ?? 'migrations';
  const queryRunner = dataSource.createQueryRunner();
  try {
    if (!(await queryRunner.hasTable(table))) {
      return known;
    }
    const rows: { name: string }[] = await queryRunner.query(`SELECT "name" FROM "${table}"`);
    const executed = new Set(rows.map((row) => row.name));
    return known.filter((name) => !executed.has(name));
  } finally {
    await queryRunner.release();
  }
}
```

Wire it into `apps/api/src/database/database.module.ts` (replace the file). `onModuleInit` runs before any module's `onApplicationBootstrap`, so install steps never run on an outdated schema:

```ts
import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { findPendingMigrations } from './pending-migrations';
import { buildDataSourceOptions } from './typeorm-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    const pending = await findPendingMigrations(this.dataSource);
    if (pending.length > 0) {
      throw new Error(
        `Database has ${pending.length} pending migration(s): ${pending.join(', ')}. ` +
          'The API does not migrate automatically. Run `pnpm --filter @offwise/api migration:run` ' +
          '(development) or `docker compose run --rm migrate` (containers), then start the API again.',
      );
    }
  }
}
```

- [ ] **Step 8: Run everything**

```bash
pnpm --filter @offwise/api test:e2e
pnpm --filter @offwise/api test
pnpm --filter @offwise/api lint
pnpm --filter @offwise/api typecheck
pnpm --filter @offwise/api start:dev   # in another terminal: curl -s localhost:3000/api/health
```

Expected: e2e PASS (3 tests); unit PASS; lint/typecheck exit 0; curl prints `{"status":"ok","db":"up"}`. Stop the dev server.

- [ ] **Step 9: Hand over for human review (ADR 0004)**

Do not stage or commit. Report the changed files (`git status --short`) and the verification results, and stop. After the human has reviewed and staged the changes, the coordinating session commits exactly what is staged:

```bash
git commit -m "feat(api): add TypeORM, migrations, e2e harness and health endpoint" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Install-step runner

**Files:**
- Create: `apps/api/src/install/install-step.ts`, `apps/api/src/install/install-step-record.entity.ts`, `apps/api/src/install/install-step-runner.service.ts`, `apps/api/src/install/install-steps.registry.ts`, `apps/api/src/install/install.module.ts`
- Create: `apps/api/src/migrations/1760313600000-CreateInstallSteps.ts`
- Modify: `apps/api/src/database/entities.ts`, `apps/api/src/migrations/index.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/src/install/install-step-runner.service.spec.ts`, `apps/api/test/install-steps.e2e-spec.ts`

**Interfaces:**
- Consumes: `DatabaseModule`, `entities`, `migrations`, `createTestApp`, `resetDatabase` (Task 3).
- Produces (later modules register steps here):
  - `interface InstallStep { readonly name: string; run(manager: EntityManager): Promise<void> }`
  - `InstallStepRecord` entity (table `install_steps`: `name` PK varchar(200), `applied_at` timestamptz)
  - `InstallStepRunner.run(steps: readonly InstallStep[]): Promise<string[]>` — returns names applied in this call, in order; throws on duplicate names or a failing step
  - `installSteps: readonly InstallStep[]` in `install-steps.registry.ts` — empty in Module 0
  - `InstallModule` — runs `installSteps` in `onApplicationBootstrap`

- [ ] **Step 1: Contract, entity and migration**

`apps/api/src/install/install-step.ts`:

```ts
import type { EntityManager } from 'typeorm';

/**
 * Seeds a module's defaults exactly once per installation (ADR 0003).
 * `name` is permanent: renaming a step makes it run again on every installation.
 */
export interface InstallStep {
  readonly name: string;
  run(manager: EntityManager): Promise<void>;
}
```

`apps/api/src/install/install-step-record.entity.ts`:

```ts
import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'install_steps' })
export class InstallStepRecord {
  @PrimaryColumn({ type: 'varchar', length: 200, primaryKeyConstraintName: 'PK_install_steps' })
  name!: string;

  @CreateDateColumn({ name: 'applied_at', type: 'timestamptz' })
  appliedAt!: Date;
}
```

`apps/api/src/migrations/1760313600000-CreateInstallSteps.ts`:

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInstallSteps1760313600000 implements MigrationInterface {
  name = 'CreateInstallSteps1760313600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "install_steps" ("name" character varying(200) NOT NULL, "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_install_steps" PRIMARY KEY ("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "install_steps"`);
  }
}
```

`apps/api/src/database/entities.ts`:

```ts
import type { DataSourceOptions } from 'typeorm';
import { InstallStepRecord } from '../install/install-step-record.entity';

/** Every TypeORM entity. Add new entities here; Nest and the TypeORM CLI both read this list. */
export const entities: DataSourceOptions['entities'] = [InstallStepRecord];
```

`apps/api/src/migrations/index.ts`:

```ts
import type { DataSourceOptions } from 'typeorm';
import { CreateInstallSteps1760313600000 } from './1760313600000-CreateInstallSteps';

/** Every migration, oldest first. After `migration:generate`, add the new class here. */
export const migrations: DataSourceOptions['migrations'] = [CreateInstallSteps1760313600000];
```

Verify the migration matches the entity:

```bash
pnpm --filter @offwise/api migration:run
pnpm --filter @offwise/api migration:generate Check
```

Before these two commands, start the API once (`pnpm --filter @offwise/api start:dev`). Expected: it stops with `Database has 1 pending migration(s): CreateInstallSteps1760313600000 ...`, which shows the startup check working.

Expected for the two commands: the first applies `CreateInstallSteps1760313600000`; the second prints `No changes in database schema were found` and creates no file. If it does generate a file, the hand-written migration and entity disagree: delete the generated file, fix the migration to match its SQL, and repeat.

- [ ] **Step 2: Failing unit test for duplicate names**

`apps/api/src/install/install-step-runner.service.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { InstallStep } from './install-step';
import { InstallStepRunner } from './install-step-runner.service';

const step = (name: string): InstallStep => ({ name, run: vi.fn() });

describe('InstallStepRunner', () => {
  it('rejects duplicate step names before touching the database', async () => {
    const transaction = vi.fn();
    const runner = new InstallStepRunner({ transaction } as unknown as DataSource);

    await expect(runner.run([step('a.one'), step('a.one')])).rejects.toThrow(
      'Duplicate install step name: a.one',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
```

`apps/api/test/install-steps.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstallStep } from '../src/install/install-step';
import { InstallStepRecord } from '../src/install/install-step-record.entity';
import { InstallStepRunner } from '../src/install/install-step-runner.service';
import { createTestApp } from './utils/create-test-app';
import { resetDatabase } from './utils/reset-database';

describe('InstallStepRunner (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let runner: InstallStepRunner;

  const recordedNames = async (): Promise<string[]> =>
    (await dataSource.getRepository(InstallStepRecord).find({ order: { name: 'ASC' } })).map(
      (record) => record.name,
    );

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    runner = app.get(InstallStepRunner);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs pending steps in order, records them, and never runs them again', async () => {
    const calls: string[] = [];
    const steps: InstallStep[] = ['test.first', 'test.second'].map((name) => ({
      name,
      run: async () => {
        calls.push(name);
      },
    }));

    await expect(runner.run(steps)).resolves.toEqual(['test.first', 'test.second']);
    await expect(runner.run(steps)).resolves.toEqual([]);

    expect(calls).toEqual(['test.first', 'test.second']);
    expect(await recordedNames()).toEqual(['test.first', 'test.second']);
  });

  it('runs only steps added since the last run', async () => {
    const first: InstallStep = { name: 'test.first', run: vi.fn() };
    const later: InstallStep = { name: 'test.later', run: vi.fn() };

    await runner.run([first]);
    await expect(runner.run([first, later])).resolves.toEqual(['test.later']);
    expect(first.run).toHaveBeenCalledTimes(1);
  });

  it('rolls back a failing step, does not record it, and stops before later steps', async () => {
    const failing: InstallStep = {
      name: 'test.failing',
      run: async (manager: EntityManager) => {
        await manager.insert(InstallStepRecord, { name: 'test.partial-write' });
        throw new Error('boom');
      },
    };
    const after: InstallStep = { name: 'test.after', run: vi.fn() };

    await expect(runner.run([failing, after])).rejects.toThrow('boom');

    expect(after.run).not.toHaveBeenCalled();
    expect(await recordedNames()).toEqual([]);
  });
});
```

Run: `pnpm --filter @offwise/api test && pnpm --filter @offwise/api test:e2e`
Expected: FAIL — `./install-step-runner.service` cannot be resolved.

- [ ] **Step 3: Implement runner, registry and module**

`apps/api/src/install/install-step-runner.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { InstallStep } from './install-step';
import { InstallStepRecord } from './install-step-record.entity';

/** Arbitrary constant key; serialises install steps across concurrently starting API instances. */
const INSTALL_LOCK_KEY = 4_242_001;

@Injectable()
export class InstallStepRunner {
  private readonly logger = new Logger(InstallStepRunner.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Runs every step not yet recorded, each in its own transaction. Returns the names applied now. */
  async run(steps: readonly InstallStep[]): Promise<string[]> {
    assertUniqueNames(steps);

    const applied: string[] = [];
    for (const step of steps) {
      const ran = await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock($1)', [INSTALL_LOCK_KEY]);
        if (await manager.existsBy(InstallStepRecord, { name: step.name })) {
          return false;
        }
        await step.run(manager);
        await manager.insert(InstallStepRecord, { name: step.name });
        return true;
      });
      if (ran) {
        applied.push(step.name);
        this.logger.log(`Applied install step ${step.name}`);
      }
    }
    return applied;
  }
}

function assertUniqueNames(steps: readonly InstallStep[]): void {
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.name)) {
      throw new Error(`Duplicate install step name: ${step.name}`);
    }
    seen.add(step.name);
  }
}
```

`apps/api/src/install/install-steps.registry.ts`:

```ts
import type { InstallStep } from './install-step';

/**
 * Every module's install steps, in the order they run on startup (after migrations).
 * Append new steps; never rename or reorder existing ones.
 */
export const installSteps: readonly InstallStep[] = [];
```

`apps/api/src/install/install.module.ts`:

```ts
import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import { InstallStepRunner } from './install-step-runner.service';
import { installSteps } from './install-steps.registry';

@Module({ providers: [InstallStepRunner], exports: [InstallStepRunner] })
export class InstallModule implements OnApplicationBootstrap {
  constructor(private readonly runner: InstallStepRunner) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runner.run(installSteps);
  }
}
```

Add `InstallModule` to `AppModule` imports, after `DatabaseModule`:

```ts
import { InstallModule } from './install/install.module';
// ...
    DatabaseModule,
    InstallModule,
    HealthModule,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @offwise/api test
pnpm --filter @offwise/api test:e2e
pnpm --filter @offwise/api lint
pnpm --filter @offwise/api typecheck
```

Expected: unit PASS (incl. the duplicate-name test); e2e PASS (health, 2 pending-migration and 3 install-step tests); lint/typecheck exit 0.

- [ ] **Step 5: Document the conventions in `apps/api/CLAUDE.md`**

In the `## Database` section, add these bullets after the `migration:run` line:

```markdown
- Entities and migrations are listed explicitly: register every new entity in `src/database/entities.ts` and every new migration class in `src/migrations/index.ts` (oldest first). The API never runs migrations itself and refuses to start while any are pending; run `migration:run` (dev) or `docker compose run --rm migrate` (containers).
- Defaults a module seeds once per installation are install steps (ADR 0003): implement `InstallStep` from `src/install/install-step.ts` next to the module and append it to `src/install/install-steps.registry.ts`. Step names are permanent.
- E2E tests run against the `offwise_test` database (created by `docker/postgres/init`); use `createTestApp()` and `resetDatabase()` from `test/utils/`.
```

- [ ] **Step 6: Hand over for human review (ADR 0004)**

Do not stage or commit. Report the changed files (`git status --short`) and the verification results, and stop. After the human has reviewed and staged the changes, the coordinating session commits exactly what is staged:

```bash
git commit -m "feat(api): add once-per-installation install-step runner" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Web app skeleton (Vue, Tailwind, shadcn-vue, i18n, API status)

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/eslint.config.js`, `apps/web/index.html`, `apps/web/env.d.ts`
- Create: `apps/web/src/main.ts`, `apps/web/src/App.vue`, `apps/web/src/router/index.ts`, `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/locales/en.json`, `apps/web/src/assets/main.css`
- Generated by shadcn-vue: `apps/web/components.json`, `apps/web/src/lib/utils.ts`, `apps/web/src/components/ui/badge/*`
- Create: `apps/web/src/lib/api.ts`, `apps/web/src/features/system/types.ts`, `apps/web/src/features/system/composables/useHealth.ts`, `apps/web/src/features/system/components/ApiStatus.vue`, `apps/web/src/pages/HomePage.vue`
- Test: `apps/web/src/lib/api.spec.ts`, `apps/web/src/features/system/composables/useHealth.spec.ts`, `apps/web/src/features/system/components/ApiStatus.spec.ts`

**Interfaces:**
- Consumes: `API_PREFIX`, `HealthResponse` from `@offwise/shared` (resolved to `packages/shared/src` via Vite alias and tsconfig `paths`).
- Produces:
  - `apiGet<T>(path: string): Promise<T>` and `class ApiError extends Error { status: number }` in `@/lib/api`
  - `type HealthState = 'loading' | 'ok' | 'error'` in `@/features/system/types`
  - `useHealth(): { state: Readonly<Ref<HealthState>>; refresh(): Promise<void> }`
  - `ApiStatus.vue` with prop `state: HealthState`
  - `i18n` instance exported from `@/i18n`

- [ ] **Step 1: Package and config files**

`apps/web/package.json`:

```json
{
  "name": "@offwise/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "vue-tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "format": "prettier --write . --ignore-path ../../.gitignore --ignore-path ../../.prettierignore"
  }
}
```

```bash
pnpm --filter @offwise/web add @offwise/shared@workspace:* vue@^3.5 vue-router@^4 vue-i18n@^11
pnpm --filter @offwise/web add -D vite@^6 @vitejs/plugin-vue@^5 typescript@~5.9 vue-tsc@^3 @types/node@^24 tailwindcss@^4 @tailwindcss/vite@^4 vitest@^3 @vue/test-utils@^2 jsdom eslint@^9 eslint-plugin-vue@^10 @vue/eslint-config-typescript@^14 @vue/eslint-config-prettier@^10
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "noEmit": true,
    "types": ["vite/client", "node"],
    "paths": {
      "@/*": ["./src/*"],
      "@offwise/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["env.d.ts", "src/**/*.ts", "src/**/*.vue", "vite.config.ts", ".storybook/**/*.ts"]
}
```

`apps/web/env.d.ts`:

```ts
/// <reference types="vite/client" />
```

`apps/web/vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Consume shared contracts from source so Vite compiles them; no build step needed.
      '@offwise/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
  },
});
```

`apps/web/eslint.config.js`:

```js
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';

export default defineConfigWithVueTs(
  { ignores: ['dist', 'coverage', 'storybook-static'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    // shadcn-vue primitives use single-word names (Badge, Button).
    files: ['src/components/ui/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
);
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>offwise</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`apps/web/src/assets/main.css`:

```css
@import 'tailwindcss';
```

- [ ] **Step 2: Initialise shadcn-vue and add Badge**

```bash
cd apps/web
pnpm dlx shadcn-vue@latest init
pnpm dlx shadcn-vue@latest add badge
cd ../..
```

Answer the init prompts: style **New York** (if asked), base color **Neutral**, CSS file `src/assets/main.css`, CSS variables **yes**, aliases `@/components`, `@/lib/utils`, `@/components/ui`. Expected afterwards: `apps/web/components.json`, `apps/web/src/lib/utils.ts` (exports `cn`), theme tokens (`--background`, `--foreground`, …) appended to `main.css`, and `apps/web/src/components/ui/badge/index.ts` + `Badge.vue`. The CLI adds its own dependencies (`reka-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, …) to `apps/web/package.json`; check none landed in the root `package.json`.

- [ ] **Step 3: App shell, router, i18n**

`apps/web/src/i18n/locales/en.json`:

```json
{
  "app": {
    "name": "offwise",
    "tagline": "Time off, made simple."
  },
  "system": {
    "apiStatus": {
      "loading": "Checking API…",
      "ok": "API connected",
      "error": "API unavailable"
    }
  }
}
```

`apps/web/src/i18n/index.ts`:

```ts
import { createI18n } from 'vue-i18n';
import en from './locales/en.json';

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
});
```

`apps/web/src/router/index.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/pages/HomePage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'home', component: HomePage }],
});
```

`apps/web/src/App.vue`:

```vue
<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <RouterView />
</template>
```

`apps/web/src/main.ts`:

```ts
import { createApp } from 'vue';
import App from './App.vue';
import './assets/main.css';
import { i18n } from './i18n';
import { router } from './router';

createApp(App).use(router).use(i18n).mount('#app');
```

- [ ] **Step 4: Write the failing tests**

`apps/web/src/lib/api.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiGet', () => {
  it('calls /api on the same origin and returns the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ a: 1 }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet<{ a: number }>('/thing')).resolves.toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/thing', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
  });

  it('throws ApiError with the status for non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));

    await expect(apiGet('/thing')).rejects.toMatchObject({ name: 'ApiError', status: 503 });
    await expect(apiGet('/thing')).rejects.toBeInstanceOf(ApiError);
  });
});
```

`apps/web/src/features/system/composables/useHealth.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHealth } from './useHealth';

afterEach(() => {
  vi.unstubAllGlobals();
});

const respond = (ok: boolean, status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status, json: async () => body }));

describe('useHealth', () => {
  it('starts in loading', () => {
    expect(useHealth().state.value).toBe('loading');
  });

  it('is ok when the API reports ok', async () => {
    respond(true, 200, { status: 'ok', db: 'up' });
    const { state, refresh } = useHealth();
    await refresh();
    expect(state.value).toBe('ok');
  });

  it('is error when the API answers 503', async () => {
    respond(false, 503, { status: 'error', db: 'down' });
    const { state, refresh } = useHealth();
    await refresh();
    expect(state.value).toBe('error');
  });

  it('is error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { state, refresh } = useHealth();
    await refresh();
    expect(state.value).toBe('error');
  });
});
```

`apps/web/src/features/system/components/ApiStatus.spec.ts`:

```ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import ApiStatus from './ApiStatus.vue';

const render = (state: 'loading' | 'ok' | 'error') =>
  mount(ApiStatus, { props: { state }, global: { plugins: [i18n] } });

describe('ApiStatus', () => {
  it.each([
    ['loading', 'Checking API…'],
    ['ok', 'API connected'],
    ['error', 'API unavailable'],
  ] as const)('shows the %s message as a status', (state, text) => {
    const wrapper = render(state);
    expect(wrapper.get('[role="status"]').text()).toBe(text);
  });
});
```

Run: `pnpm --filter @offwise/web test`
Expected: FAIL — modules `./api`, `./useHealth`, `./ApiStatus.vue` not found.

- [ ] **Step 5: Implement**

`apps/web/src/lib/api.ts`:

```ts
import { API_PREFIX } from '@offwise/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** GET a JSON resource from the API on the same origin, e.g. apiGet('/health'). */
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/${API_PREFIX}${path}`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${path} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}
```

`apps/web/src/features/system/types.ts`:

```ts
export type HealthState = 'loading' | 'ok' | 'error';
```

`apps/web/src/features/system/composables/useHealth.ts`:

```ts
import type { HealthResponse } from '@offwise/shared';
import { readonly, ref } from 'vue';
import { apiGet } from '@/lib/api';
import type { HealthState } from '../types';

export function useHealth() {
  const state = ref<HealthState>('loading');

  async function refresh(): Promise<void> {
    state.value = 'loading';
    try {
      const health = await apiGet<HealthResponse>('/health');
      state.value = health.status === 'ok' ? 'ok' : 'error';
    } catch {
      state.value = 'error';
    }
  }

  return { state: readonly(state), refresh };
}
```

`apps/web/src/features/system/components/ApiStatus.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import type { HealthState } from '../types';

const props = defineProps<{ state: HealthState }>();
const { t } = useI18n();

const variant = computed(() => {
  if (props.state === 'ok') return 'default';
  if (props.state === 'error') return 'destructive';
  return 'secondary';
});
</script>

<template>
  <Badge :variant="variant" role="status" aria-live="polite">
    {{ t(`system.apiStatus.${state}`) }}
  </Badge>
</template>
```

`apps/web/src/pages/HomePage.vue`:

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import ApiStatus from '@/features/system/components/ApiStatus.vue';
import { useHealth } from '@/features/system/composables/useHealth';

const { t } = useI18n();
const { state, refresh } = useHealth();

onMounted(refresh);
</script>

<template>
  <main
    class="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 bg-background p-6 text-center"
  >
    <h1 class="text-3xl font-semibold text-foreground">{{ t('app.name') }}</h1>
    <p class="text-muted-foreground">{{ t('app.tagline') }}</p>
    <ApiStatus :state="state" />
  </main>
</template>
```

- [ ] **Step 6: Run tests, lint, typecheck, build**

```bash
pnpm --filter @offwise/web test
pnpm --filter @offwise/web lint
pnpm --filter @offwise/web typecheck
pnpm --filter @offwise/web build
```

Expected: tests PASS (2 + 4 + 3); lint, typecheck and build exit 0.

- [ ] **Step 7: See it running**

With `docker compose up -d db` and `pnpm --filter @offwise/api start:dev` running, run `pnpm --filter @offwise/web dev` and open http://localhost:5173. Expected: "offwise", the tagline, and a badge reading "API connected". Stop the API and reload: the badge reads "API unavailable".

- [ ] **Step 8: Hand over for human review (ADR 0004)**

Do not stage or commit. Report the changed files (`git status --short`) and the verification results, and stop. After the human has reviewed and staged the changes, the coordinating session commits exactly what is staged:

```bash
git commit -m "feat(web): scaffold Vue app with Tailwind, shadcn-vue, i18n and API status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Storybook

**Files:**
- Create: `apps/web/.storybook/main.ts`, `apps/web/.storybook/preview.ts`
- Create: `apps/web/src/features/system/components/ApiStatus.stories.ts`
- Modify: `apps/web/package.json` (scripts)

**Interfaces:**
- Consumes: `ApiStatus.vue`, `i18n`, `src/assets/main.css` (Task 5).
- Produces: `storybook` and `build-storybook` scripts; the global Storybook setup (i18n plugin + theme CSS) every later story relies on.

- [ ] **Step 1: Install and configure**

```bash
pnpm --filter @offwise/web add -D storybook@^9 @storybook/vue3-vite@^9
```

Add to `apps/web/package.json` `scripts`:

```json
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
```

`apps/web/.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  framework: { name: '@storybook/vue3-vite', options: {} },
};

export default config;
```

`apps/web/.storybook/preview.ts`:

```ts
import { setup, type Preview } from '@storybook/vue3-vite';
import { i18n } from '../src/i18n';
import '../src/assets/main.css';

setup((app) => {
  app.use(i18n);
});

const preview: Preview = {
  parameters: { layout: 'centered' },
};

export default preview;
```

If `setup` is not exported from `@storybook/vue3-vite` in the installed version, import it from `@storybook/vue3` instead (add that package with the same major version).

- [ ] **Step 2: Story for ApiStatus**

`apps/web/src/features/system/components/ApiStatus.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ApiStatus from './ApiStatus.vue';

const meta = {
  title: 'System/ApiStatus',
  component: ApiStatus,
  args: { state: 'ok' },
} satisfies Meta<typeof ApiStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = { args: { state: 'ok' } };
export const Loading: Story = { args: { state: 'loading' } };
export const Unavailable: Story = { args: { state: 'error' } };
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter @offwise/web build-storybook
pnpm --filter @offwise/web lint
pnpm --filter @offwise/web typecheck
pnpm --filter @offwise/web test
```

Expected: `build-storybook` writes `apps/web/storybook-static` and exits 0; the rest exit 0. Optionally run `pnpm --filter @offwise/web storybook` and check that the three ApiStatus stories render with the theme colours and English text.

- [ ] **Step 4: Hand over for human review (ADR 0004)**

Do not stage or commit. Report the changed files (`git status --short`) and the verification results, and stop. After the human has reviewed and staged the changes, the coordinating session commits exactly what is staged:

```bash
git commit -m "feat(web): add Storybook with ApiStatus stories" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Full stack in Docker Compose, docs and final verification

**Files:**
- Create: `.dockerignore`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/web/nginx.conf`
- Modify: `docker-compose.yml`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `docker compose up` serving the web app on http://localhost:8080 with `/api` proxied to the API; Mailpit UI on http://localhost:8025 (SMTP on 1025) ready for Module 1.

- [ ] **Step 1: Dockerfiles**

`.dockerignore`:

```
**/node_modules
**/dist
**/coverage
**/storybook-static
**/.env
.git
```

`apps/api/Dockerfile`:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @offwise/api... --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @offwise/api build
RUN pnpm --filter @offwise/api deploy --legacy --prod /out

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

`apps/web/nginx.conf`:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://api:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

`apps/web/Dockerfile`:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @offwise/web... --ignore-scripts
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @offwise/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
```

- [ ] **Step 2: Compose services**

Replace `docker-compose.yml` with:

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: offwise
      POSTGRES_PASSWORD: offwise
      POSTGRES_DB: offwise
    ports:
      - '5432:5432'
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U offwise -d offwise']
      interval: 5s
      timeout: 5s
      retries: 10

  mailpit:
    image: axllent/mailpit:v1.27
    ports:
      - '8025:8025' # web UI
      - '1025:1025' # SMTP

  # One-shot migration command; never started by `docker compose up`.
  # Run explicitly: docker compose run --rm migrate
  migrate:
    profiles: ['migrate']
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    command: ['node', 'dist/migrate.js']
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://offwise:offwise@db:5432/offwise
    depends_on:
      db:
        condition: service_healthy

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3000
      LOG_LEVEL: info
      DATABASE_URL: postgresql://offwise:offwise@db:5432/offwise
    depends_on:
      db:
        condition: service_healthy
    ports:
      - '3000:3000'

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    depends_on:
      - api
    ports:
      - '8080:80'

volumes:
  db-data: {}
```

- [ ] **Step 3: Verify the stack**

```bash
docker compose down -v
docker compose build
docker compose up -d
docker compose logs api | grep "pending migration"
docker compose run --rm migrate
docker compose up -d
docker compose logs api | grep -E "Nest application successfully started|Error"
curl -s http://localhost:8080/api/health
curl -s http://localhost:8080/ | grep -o '<title>offwise</title>'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8025
docker compose exec db psql -U offwise -d offwise -c '\dt'
```

Expected: on the first `up` the api container exits with `Database has 1 pending migration(s)` (the API does not migrate itself); `migrate` prints `Applied migrations: CreateInstallSteps1760313600000`; after the second `up` the api log shows the start line and no errors; health prints `{"status":"ok","db":"up"}`; the title matches; Mailpit returns `200`; `\dt` lists `install_steps` and `migrations`. Open http://localhost:8080: the badge reads "API connected". Then `docker compose down`.

If the API image fails at `deploy` because `dist` is missing from `/out`, check `"files": ["dist"]` in both `apps/api/package.json` and `packages/shared/package.json`.

- [ ] **Step 4: Docs**

`README.md`:

````markdown
# offwise

Time off, made simple. A self-hostable leave management app.

## Run the whole stack

```bash
docker compose build
docker compose run --rm migrate    # migrations never run automatically; repeat after every upgrade
docker compose up
```

- App: http://localhost:8080
- API health: http://localhost:8080/api/health
- Mailpit (dev mail inbox): http://localhost:8025

## Develop

Requires Node 24 and pnpm 10 (`corepack enable`).

```bash
pnpm install                                  # also builds @offwise/shared
docker compose up -d db mailpit
cp apps/api/.env.example apps/api/.env
pnpm --filter @offwise/api migration:run      # the API refuses to start with pending migrations
pnpm --filter @offwise/api start:dev          # http://localhost:3000/api
pnpm --filter @offwise/web dev                # http://localhost:5173 (proxies /api)
```

Checks: `pnpm -r lint`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm --filter @offwise/api test:e2e`, `pnpm --filter @offwise/web build-storybook`.

See `CLAUDE.md` for conventions and `docs/` for specs, plans and decisions.
````

In root `CLAUDE.md`, replace the heading `## Commands (once scaffolded)` with `## Commands`, and add one line to the code block after `pnpm install`:

```bash
docker compose up -d db mailpit    # just the dependencies, for running api/web locally
```

Also drop `(once scaffolded)` from the `## Commands` headings in `apps/api/CLAUDE.md` and `apps/web/CLAUDE.md`.

- [ ] **Step 5: Final verification from a clean install**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules packages/shared/dist
pnpm install
docker compose up -d db
pnpm -r lint
pnpm -r typecheck
pnpm -r test
pnpm --filter @offwise/api test:e2e
pnpm --filter @offwise/web build-storybook
pnpm format:check
```

Expected: every command exits 0. If only `format:check` fails, run `pnpm -r format`, review the diff, and re-run. Read the output; report any failure instead of claiming success.

- [ ] **Step 6: Hand over for human review (ADR 0004)**

Do not stage or commit. Report the changed files (`git status --short`) and the verification results, and stop. After the human has reviewed and staged the changes, the coordinating session commits exactly what is staged:

```bash
git commit -m "chore: run full stack with docker compose; document dev workflow" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage (Module 0)

| Spec item | Task |
| --- | --- |
| pnpm workspaces, Nest and Vue apps, `@offwise/shared` | 1, 2, 5 |
| docker compose with `db`, `api`, `web`, Mailpit | 3, 7 |
| Env validation (`NODE_ENV`, `PORT`, `LOG_LEVEL`, `DATABASE_URL`), `.env.example` | 2, 3 |
| TypeORM data source and migrations, shared options; no automatic migrations, startup refuses pending migrations | 3, 7 |
| Install-step runner (`install_steps`, once per installation, after migrations) | 4 |
| Health endpoint | 3 |
| vue-i18n with English only | 5 |
| Required scripts in every workspace; Storybook | 1, 2, 3, 5, 6 |
| E2E test-data isolation (ADR 0001 consequence) | 3 |

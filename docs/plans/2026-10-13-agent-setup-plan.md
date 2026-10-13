# Claude Code / Agent Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commit the shared Claude Code setup for offwise: project memory (CLAUDE.md files), shared settings that enable Superpowers, `frontend` and `backend` subagents, and the docs folder structure.

**Architecture:** A root `CLAUDE.md` holds product, layout, commands, and workflow. Each app has a `CLAUDE.md` with its stack conventions, loaded only when working in that app. Two subagents in `.claude/agents/` defer to those files. A committed `.claude/settings.json` enables the Superpowers plugin for every teammate.

**Tech Stack:** Claude Code (CLAUDE.md, subagents, project settings), Superpowers plugin. The documented app stack is pnpm workspaces, Vue 3, shadcn-vue, Storybook, NestJS, PostgreSQL, and docker compose.

**Spec:** `docs/specs/2026-10-13-agent-setup-design.md`

## Global Constraints

- Nothing here scaffolds application code: no `package.json`, no `apps/*/src`, no `docker-compose.yml`.
- Plain pnpm workspaces, **no Turborepo**.
- ORM is **not decided**. Do not name Prisma, Drizzle, or TypeORM as the choice anywhere; refer to "the ORM (see `docs/decisions/`)".
- `.claude/settings.json` contains only `extraKnownMarketplaces` and `enabledPlugins`: no permissions, no hooks.
- Specs go in `docs/specs/YYYY-MM-DD-<topic>-design.md`, plans in `docs/plans/YYYY-MM-DD-<topic>-plan.md`, and ADRs in `docs/decisions/NNNN-<title>.md`.
- Package names: `@offwise/web` (`apps/web`), `@offwise/api` (`apps/api`), `@offwise/shared` (`packages/shared`).
- Commands that need scaffolded apps are marked "(once scaffolded)".
- Work on branch `chore/agent-setup`; commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Shared settings, gitignore, and docs structure

**Files:**
- Create: `.claude/settings.json`
- Modify: `.gitignore` (append)
- Create: `docs/decisions/README.md`

**Interfaces:**
- Produces: plugin id `superpowers@superpowers-dev`, the ADR file naming `docs/decisions/NNNN-<title>.md`, and the ADR template referenced by the root CLAUDE.md (Task 2).

- [ ] **Step 1: Write `.claude/settings.json`**

```json
{
  "extraKnownMarketplaces": {
    "superpowers-dev": {
      "source": {
        "source": "git",
        "url": "https://github.com/obra/superpowers.git"
      }
    }
  },
  "enabledPlugins": {
    "superpowers@superpowers-dev": true
  }
}
```

- [ ] **Step 2: Append to `.gitignore`**

```gitignore

# Claude Code personal overrides
.claude/settings.local.json
```

- [ ] **Step 3: Write `docs/decisions/README.md`**

```markdown
# Architecture Decision Records

Short records of decisions that shape the stack or architecture (e.g. choice of ORM, auth approach).

- File name: `NNNN-<kebab-title>.md`, numbered sequentially (`0001-...`).
- Never edit an accepted ADR's decision; supersede it with a new ADR and mark the old one `Superseded by NNNN`.

## Template

    # NNNN: <Title>

    **Status:** Proposed | Accepted | Superseded by NNNN
    **Date:** YYYY-MM-DD

    ## Context
    What forces us to decide, and what constraints apply.

    ## Decision
    What we chose.

    ## Consequences
    What gets easier, what gets harder, what we must now do.

## Open decisions

- ORM for PostgreSQL: decide before the first schema work.
```

- [ ] **Step 4: Verify**

Run: `python3 -m json.tool .claude/settings.json >/dev/null && echo OK && git check-ignore .claude/settings.local.json`
Expected: `OK` then `.claude/settings.local.json`

- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json .gitignore docs/decisions/README.md
git commit -m "chore: share Superpowers plugin config and add ADR folder"
```

---

### Task 2: Root CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Interfaces:**
- Consumes: plugin and ADR conventions from Task 1.
- Produces: agent names `frontend` and `backend` (defined in Tasks 3 and 4); the doc paths above.

- [ ] **Step 1: Write `CLAUDE.md`**

````markdown
# offwise

Time off, made simple: a leave management app where employees request time off, managers approve it, and everyone sees who is away.

## Repo layout

pnpm monorepo (plain pnpm workspaces, no Turborepo).

```
apps/web/          @offwise/web     Vue 3 + shadcn-vue + Tailwind + Storybook   → see apps/web/CLAUDE.md
apps/api/          @offwise/api     NestJS + PostgreSQL                         → see apps/api/CLAUDE.md
packages/shared/   @offwise/shared  Types and API contracts shared by web and api
docs/specs/        Design specs     YYYY-MM-DD-<topic>-design.md
docs/plans/        Impl. plans      YYYY-MM-DD-<topic>-plan.md
docs/decisions/    ADRs             NNNN-<title>.md (see docs/decisions/README.md)
```

TypeScript everywhere. ESLint and Prettier. The ORM is not decided yet; see `docs/decisions/`, and do not pick one without an ADR.

## Commands (once scaffolded)

```bash
pnpm install                       # install all workspaces
docker compose up                  # start web, api, and postgres
pnpm -r lint                       # lint everything
pnpm -r typecheck                  # typecheck everything
pnpm -r test                       # unit tests everywhere
pnpm --filter @offwise/web storybook   # component review
pnpm --filter @offwise/api test:e2e    # API e2e (needs postgres from docker compose)
```

Add dependencies to the workspace that uses them (`pnpm --filter <pkg> add <dep>`), never to the root unless it is repo tooling.

## Workflow

We use the Superpowers plugin (enabled in `.claude/settings.json`, so trust the repo to install it) plus two project agents.

1. **Spec:** `superpowers:brainstorming` writes to `docs/specs/`. A human reviews it in a PR.
2. **Plan:** `superpowers:writing-plans` writes to `docs/plans/`.
3. **Implement:** on a feature branch, using `superpowers:subagent-driven-development` with TDD (`superpowers:test-driven-development`).
   - `apps/web` work → `frontend` agent
   - `apps/api` work → `backend` agent
   - Contract changes in `packages/shared` go with the backend task that introduces them.
4. **Verify and review:** `superpowers:verification-before-completion`, then `superpowers:requesting-code-review`, then a PR to `main`.

These paths override the Superpowers defaults: specs go in `docs/specs/` and plans in `docs/plans/`, **not** `docs/superpowers/...`.

## Team rules

- Never commit directly to `main`. Branch (`feat/…`, `fix/…`, `chore/…`), then open a PR.
- Decisions that change the stack or architecture get an ADR in `docs/decisions/`.
- Don't claim something works without running the relevant lint, typecheck, and tests and reading their output.
- Leave domain logic (balances, accrual, approvals, holidays) in the API; the web app displays and submits, it does not compute entitlements.
- Personal Claude settings go in `.claude/settings.local.json` (gitignored), not `.claude/settings.json`.
````

- [ ] **Step 2: Verify the referenced paths and names**

Run: `grep -cE "docs/(specs|plans|decisions)/" CLAUDE.md && grep -iE "prisma|drizzle|typeorm|turbo " CLAUDE.md || echo "no forbidden names"`
Expected: a count ≥ 3, then `no forbidden names`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add root CLAUDE.md with layout, commands and workflow"
```

---

### Task 3: Frontend conventions and `frontend` agent

**Files:**
- Create: `apps/web/CLAUDE.md`
- Create: `.claude/agents/frontend.md`

**Interfaces:**
- Consumes: root `CLAUDE.md` (Task 2) and the package names in Global Constraints.
- Produces: subagent `frontend`.

- [ ] **Step 1: Write `apps/web/CLAUDE.md`**

````markdown
# @offwise/web

Vue 3 SPA for offwise. Read the root `CLAUDE.md` first.

## Stack

Vue 3 (Composition API), Vite, TypeScript, Tailwind, shadcn-vue (https://github.com/unovue/shadcn-vue), Storybook, Vitest + Vue Test Utils.

## Commands (once scaffolded)

```bash
pnpm --filter @offwise/web dev
pnpm --filter @offwise/web lint
pnpm --filter @offwise/web typecheck
pnpm --filter @offwise/web test
pnpm --filter @offwise/web storybook          # review components locally
pnpm --filter @offwise/web build-storybook    # must pass before done
```

## Conventions

- `<script setup lang="ts">` in every SFC. Type props with `defineProps<…>()` and emits with `defineEmits<…>()`.
- **shadcn-vue first.** Add primitives with the shadcn-vue CLI into `src/components/ui/`, and treat them as owned code (style tweaks are fine; keep the API). Compose them before writing a custom primitive.
- Tailwind for styling, using the shadcn-vue theme tokens (`bg-background`, `text-muted-foreground`, …), never hard-coded colours.
- Feature components live in `src/features/<feature>/components/`; shared app-level components live in `src/components/`.
- Presentational components take data through props and emit events; data fetching lives in composables (`src/features/<feature>/composables/use*.ts`).
- API request/response types come from `@offwise/shared`. Don't redefine them locally.
- No leave/balance calculations in the frontend; display what the API returns.

## Storybook

- Every new or changed presentational component has a co-located `<Component>.stories.ts` (CSF3).
- Cover the meaningful states: default, loading, empty, error, and disabled where relevant.
- Stories use static props or mocked data; no real network calls.

## Accessibility

Semantic elements, labelled form controls, full keyboard operability, visible focus states. Prefer the shadcn-vue (Reka UI) primitives, which handle ARIA for dialogs, menus, and popovers.

## Tests

Vitest + Vue Test Utils for component behaviour and composables. Test what the user sees and does (rendered text, emitted events), not internals.
````

- [ ] **Step 2: Write `.claude/agents/frontend.md`**

```markdown
---
name: frontend
description: Implements and changes UI in apps/web (Vue 3 + shadcn-vue + Tailwind + Storybook). Use for any frontend task from a plan, new components, pages, composables, or Storybook stories.
---

You are the frontend engineer for offwise.

Before writing anything, read `CLAUDE.md` (repo root) and `apps/web/CLAUDE.md`, and follow them. They take precedence over your general habits.

How you work:
1. Follow TDD: write a failing Vitest test, make it pass, then refactor.
2. Reach for shadcn-vue primitives before writing custom ones.
3. Every new or changed presentational component gets a `*.stories.ts` covering its main states (default, loading, empty, error, disabled where relevant).
4. Use types from `@offwise/shared` for API data. If a contract you need is missing, stop and report it instead of inventing it locally.
5. Check basic accessibility: semantic markup, labels, keyboard operability, focus states.
6. Stay inside your task's scope. No drive-by refactors.

Before reporting done, run and read the output of:
- `pnpm --filter @offwise/web lint`
- `pnpm --filter @offwise/web typecheck`
- `pnpm --filter @offwise/web test`
- `pnpm --filter @offwise/web build-storybook`

Report: files changed, stories added, and each command with its pass/fail result. If anything fails or was skipped, say so plainly.
```

- [ ] **Step 3: Verify the frontmatter**

Run: `head -4 .claude/agents/frontend.md`
Expected: `---`, `name: frontend`, a `description:` line, `---`

- [ ] **Step 4: Commit**

```bash
git add apps/web/CLAUDE.md .claude/agents/frontend.md
git commit -m "docs: add web conventions and frontend agent"
```

---

### Task 4: Backend conventions and `backend` agent

**Files:**
- Create: `apps/api/CLAUDE.md`
- Create: `.claude/agents/backend.md`

**Interfaces:**
- Consumes: root `CLAUDE.md` (Task 2) and the package names in Global Constraints.
- Produces: subagent `backend`.

- [ ] **Step 1: Write `apps/api/CLAUDE.md`**

````markdown
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
````

- [ ] **Step 2: Write `.claude/agents/backend.md`**

```markdown
---
name: backend
description: Implements and changes the NestJS API in apps/api and shared contracts in packages/shared (modules, controllers, services, DTOs, migrations, tests). Use for any backend or API-contract task from a plan.
---

You are the backend engineer for offwise.

Before writing anything, read `CLAUDE.md` (repo root) and `apps/api/CLAUDE.md`, and follow them. They take precedence over your general habits.

How you work:
1. Follow TDD: write a failing Jest test (unit, or e2e for endpoints), make it pass, then refactor.
2. Keep the NestJS structure: thin controllers, logic in services, class-validator DTOs for every input.
3. Put request/response contracts the web app consumes in `@offwise/shared`, and implement them in your DTOs.
4. Every schema change gets a migration. Never write a destructive migration without explicit approval; stop and ask instead.
5. The ORM is not decided until an ADR in `docs/decisions/` says so. If your task needs persistence and no ADR exists, stop and report it.
6. Stay inside your task's scope. No drive-by refactors.

Before reporting done, run and read the output of:
- `pnpm --filter @offwise/api lint`
- `pnpm --filter @offwise/api typecheck`
- `pnpm --filter @offwise/api test`
- `pnpm --filter @offwise/api test:e2e` (with `docker compose up -d db`)

Report: files changed, endpoints or contracts added or changed, migrations added, and each command with its pass/fail result. If anything fails or was skipped, say so plainly.
```

- [ ] **Step 3: Verify the frontmatter and the ORM constraint**

Run: `head -4 .claude/agents/backend.md && grep -iE "prisma|drizzle|typeorm" apps/api/CLAUDE.md .claude/agents/backend.md || echo "no ORM named"`
Expected: frontmatter with `name: backend`, then `no ORM named`

- [ ] **Step 4: Commit**

```bash
git add apps/api/CLAUDE.md .claude/agents/backend.md
git commit -m "docs: add api conventions and backend agent"
```

---

### Task 5: End-to-end check

**Files:** none (verification only)

- [ ] **Step 1: Confirm the tree matches the spec**

Run: `git ls-files CLAUDE.md apps .claude docs | sort`
Expected:
```
.claude/agents/backend.md
.claude/agents/frontend.md
.claude/settings.json
CLAUDE.md
apps/api/CLAUDE.md
apps/web/CLAUDE.md
docs/decisions/README.md
docs/plans/2026-10-13-agent-setup-plan.md
docs/specs/2026-10-13-agent-setup-design.md
```

- [ ] **Step 2: Confirm Claude Code sees the agents**

Run: `claude agents` (or `/agents` in a new session in the repo)
Expected: `frontend` and `backend` are listed under project agents.

- [ ] **Step 3: Hand off for PR**

Use `superpowers:finishing-a-development-branch` to open a PR from `chore/agent-setup` to `main`.

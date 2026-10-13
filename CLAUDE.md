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

TypeScript everywhere. ESLint and Prettier. ORM: TypeORM (see `docs/decisions/0001-use-typeorm.md`).

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

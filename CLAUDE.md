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

Development runs in the devcontainer (`.devcontainer/`, ADR 0007); Claude Code runs inside it.

## Commands

```bash
pnpm install                       # install all workspaces
pnpm dev                           # api + web dev servers (inside the devcontainer)
pnpm -r lint                       # lint everything
pnpm -r typecheck                  # typecheck everything
pnpm -r test                       # unit tests everywhere
pnpm -r format                     # prettier
pnpm --filter @offwise/web storybook   # component review
pnpm --filter @offwise/api test:e2e    # API e2e (needs postgres + redis: devcontainer or docker compose up -d db redis mailpit)
```

Scaffolding must define `lint`, `typecheck`, `test` and `format` in every workspace; `test:e2e`, `migration:generate` and `migration:run` in api; and `storybook` and `build-storybook` in web. It must also define a compose service named `db`, because the agents depend on these names.

Add dependencies to the workspace that uses them (`pnpm --filter <pkg> add <dep>`), never to the root unless it is repo tooling.

## Workflow

We use the Superpowers plugin plus two project agents. When you first open the repo in Claude Code and trust the folder, you'll be prompted to add the `superpowers-dev` marketplace and install the plugin; accept both.

1. **Branch:** create the branch first (`feat/<topic>`, etc.). The spec, plan, and implementation commits all go on it, so brainstorming must not run on `main`.
2. **Spec:** `superpowers:brainstorming` writes to `docs/specs/`. A human reviews it in a PR.
3. **Plan:** `superpowers:writing-plans` writes to `docs/plans/`.
4. **Implement:** on the feature branch, using `superpowers:subagent-driven-development` with TDD (`superpowers:test-driven-development`).
   - `apps/web` work → `frontend` agent
   - `apps/api` work → `backend` agent
   - Contract changes in `packages/shared` go with the backend task that introduces them.
   - When `superpowers:subagent-driven-development` dispatches an implementer, use the `frontend` subagent type for `apps/web` tasks and `backend` for `apps/api` and `packages/shared` tasks, instead of general-purpose. Keep the skill's prompt and report format.
5. **Verify and review:** `superpowers:verification-before-completion`, then `superpowers:requesting-code-review`, then a PR to `main`.

**Every commit point is a human review gate (ADR 0004).** Wherever a Superpowers skill or a plan says to commit (spec, plan, each implementation task), the agent instead stops, leaves the changes unstaged, and reports the changed files and verification results. A human reviews the diff and stages what they accept; only then may the agent run `git commit` on exactly what is staged. Subagent implementers never commit; the coordinating session waits for the human before committing and before dispatching the next task.

These paths override the Superpowers defaults: specs go in `docs/specs/` and plans in `docs/plans/`, **not** `docs/superpowers/...`.

## Team rules

- Never commit directly to `main`. Branch (`feat/…`, `fix/…`, `chore/…`), then open a PR.
- Agents never stage or unstage files (no `git add`, `git rm`, `git mv`, `git commit -a` or `git commit <paths>`, `git stash`, `git restore --staged`, `git reset`). A human stages after reviewing; agents commit only what is already staged. Agents may push feature branches and open PRs, but never merge, enable auto-merge or force-push; merging into `main` needs a human approving review (ADR 0004).
- Decisions that change the stack or architecture get an ADR in `docs/decisions/`.
- Don't claim something works without running the relevant lint, typecheck, and tests and reading their output.
- Leave domain logic (balances, accrual, approvals, holidays) in the API; the web app displays and submits, it does not compute entitlements.
- Build for small companies, not high load. offwise serves relatively small companies, not thousands of requests per second. Don't add caches (process-wide or cross-request), replicas-aware invalidation, or other high-load engineering at this stage; a plain database read is fine. Caching for the length of a single request is acceptable when one request repeats the same lookup.
- Personal Claude settings go in `.claude/settings.local.json` (gitignored), not `.claude/settings.json`.

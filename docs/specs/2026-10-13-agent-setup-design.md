# Claude Code / Agent Setup — Design

**Date:** 2026-10-13
**Status:** Approved (pending spec review)

## Goal

Set up Claude Code project memory, team workflow, and project-specific agents for **offwise** (simple leave management) before any application code is written. The setup must work for a small team: everything needed is committed to the repo, and nothing depends on one person's personal `~/.claude` config.

Out of scope: shared permissions and hooks, and scaffolding the actual apps. The apps are scaffolded from the first product spec.

## Stack (context for conventions)

- pnpm monorepo, **plain pnpm workspaces** (no Turborepo; revisit if builds or CI get slow)
- TypeScript everywhere
- `apps/web`: Vue 3, shadcn-vue, Tailwind, Storybook (component review), Vitest
- `apps/api`: NestJS, class-validator DTOs, Jest (unit and e2e with supertest)
- `packages/shared`: shared types and API contracts
- PostgreSQL. **ORM not decided yet**; it gets decided and recorded as an ADR in `docs/decisions/` before the first schema work.
- `docker compose up` starts the whole stack (web, api, db)
- ESLint and Prettier

## Approach

One root `CLAUDE.md` plus one `CLAUDE.md` in each app. Claude loads an app's file only when working in that app, so context stays lean. The agents point at the matching file, so each convention lives in one place. (Alternatives considered: a single big root file, which loads everything and rots; tool-agnostic `AGENTS.md` imported by `CLAUDE.md`, which is not needed while the team uses only Claude Code and is cheap to switch to later.)

## File layout

```
CLAUDE.md                  # root: product, layout, commands, workflow, team rules
apps/web/CLAUDE.md         # Vue / shadcn-vue / Storybook conventions
apps/api/CLAUDE.md         # NestJS / Postgres conventions
.claude/
  settings.json            # shared: Superpowers marketplace + plugin enabled for everyone
  agents/
    frontend.md            # Vue + shadcn-vue component agent
    backend.md             # NestJS / API agent
docs/
  specs/                   # design specs: YYYY-MM-DD-<topic>-design.md
  plans/                   # implementation plans: YYYY-MM-DD-<topic>-plan.md
  decisions/               # ADRs: NNNN-<title>.md
```

`.claude/settings.local.json` is gitignored and holds personal overrides.

`apps/web/CLAUDE.md` and `apps/api/CLAUDE.md` are created now, ahead of the apps, so conventions exist before the first line of code. Commands in them that depend on scaffolding are marked as "available once the app is scaffolded".

## Workflow (documented in root CLAUDE.md)

Hybrid: the Superpowers plugin covers the generic process, and the project agents cover domain and stack specifics.

1. **Spec:** `superpowers:brainstorming` writes to `docs/specs/`. A human reviews it in a PR.
2. **Plan:** `superpowers:writing-plans` writes to `docs/plans/`.
3. **Implement:** on a feature branch (worktree optional), using `superpowers:subagent-driven-development`. Frontend tasks go to the `frontend` agent and backend tasks to the `backend` agent. TDD (`superpowers:test-driven-development`).
4. **Verify and review:** `superpowers:verification-before-completion`, then `superpowers:requesting-code-review`, then a PR to `main`.

Team rules:
- No direct commits to `main`; every change goes through a PR.
- Spec and plan paths override the Superpowers defaults (`docs/specs`, `docs/plans`, not `docs/superpowers/...`).
- Decisions that affect the stack go in an ADR.

## Shared settings

`.claude/settings.json` declares only the Superpowers marketplace (`extraKnownMarketplaces`) and enables the plugin (`enabledPlugins`), so teammates are prompted to install it when they trust the repo. No permissions and no hooks.

## Agents

Both agents:
- have access to all tools
- read the root `CLAUDE.md` and their app's `CLAUDE.md` first
- follow TDD
- report what they changed, plus the verification commands they ran and the results
- never claim done without running verification

**frontend** (`apps/web`, `packages/shared` types):
- Uses shadcn-vue primitives before writing custom components; Tailwind for styling; Composition API with `<script setup lang="ts">`.
- Every new or changed presentational component has a `*.stories.ts` covering its main states (default, loading, empty, error, disabled where relevant).
- Basic a11y: semantic elements, labels, keyboard operability, focus states.
- Before done: lint, typecheck, Vitest, Storybook build.

**backend** (`apps/api`, `packages/shared` contracts):
- NestJS structure: one module per domain area, with a thin controller, the logic in a service, and DTOs validated with class-validator.
- Every schema change ships with a migration; no destructive migrations without explicit approval.
- API contracts that the frontend consumes live in `packages/shared`.
- Before done: lint, typecheck, Jest unit tests, and e2e tests against Postgres (via docker compose).

## Success criteria

- A teammate who clones the repo and trusts it gets Superpowers enabled and the two agents available.
- The root `CLAUDE.md` alone is enough to learn the layout, commands, and workflow.
- The first product feature can start straight away with `brainstorming` → `docs/specs/`.

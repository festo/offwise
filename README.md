# offwise

Time off, made simple. A self-hostable leave management app.

## Develop (devcontainer)

Requires Docker (Compose ≥ 2.24) and VS Code (or Cursor) with the Dev Containers extension, or the devcontainer CLI.

1. Open the repo and choose **Reopen in Container**. The first start installs dependencies, creates `apps/api/.env`, and runs migrations and install steps.
2. Run `pnpm dev` in the container terminal.
   - Web: http://localhost:5173
   - API: http://localhost:3000/api (health: `/api/health`)
   - Mailpit (dev mail inbox): http://localhost:8025
   - Storybook: `pnpm --filter @offwise/web storybook` → http://localhost:6006
3. After pulling new code: `pnpm install`, `pnpm --filter @offwise/api migration:run`, `pnpm --filter @offwise/api install:run` (the API never runs them itself).

Tear down: delete the container and its volumes (VS Code: *Dev Containers: Clean Up Dev Volumes*, or `docker compose -f docker-compose.yml -f .devcontainer/compose.yml down -v` from the repo root). The devcontainer has its own Compose project and database volume, so a host `docker compose up -d db` is never affected.

Checks: `pnpm -r lint`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm --filter @offwise/api test:e2e`, `pnpm --filter @offwise/web build-storybook`.

Without the devcontainer: Node 24, pnpm 10 (`corepack enable`), `docker compose up -d db`, then the same commands.

See `CLAUDE.md` for conventions and `docs/` for specs, plans and decisions.

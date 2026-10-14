# 0007: Develop in a devcontainer

**Status:** Accepted
**Date:** 2026-10-14

## Context
Local development needs Postgres (plus a test database), a mail catcher, Node 24 and pnpm 10. Installing these on each developer's machine drifts over time, leaves processes behind (stray dev servers, watchers) and is hard to tear down. AI agents (Claude Code) also run commands during development; they should work in an environment isolated from the developer's own files and processes. Deployable images are not needed yet.

## Decision
- The supported development environment is a **devcontainer** (`.devcontainer/`), opened from VS Code, Cursor or the devcontainer CLI.
- It is a compose setup: a `workspace` container (Node 24 dev image, pnpm via corepack, Claude Code installed via its devcontainer feature) plus `db` (reused from the root `docker-compose.yml`, port not published to the host) and `mailpit`. `workspace` and `mailpit` share `db`'s network namespace, so every service is on `localhost` inside the container, exactly as in host-based development.
- `node_modules` directories, the pnpm store and the Claude Code config live in named volumes, so Linux-native binaries never mix with the host's and tear-down is "remove the containers and volumes".
- Creating the container runs `pnpm install`, creates `apps/api/.env` from `.env.example` if missing, then `migration:run` and `install:run`. After pulling new code, developers run those two commands themselves (ADR 0006).
- `pnpm dev` at the root starts the API and web dev servers together; ports 5173, 3000, 6006 and 8025 are forwarded to the host.
- Claude Code inside the container has normal outbound network access (no firewall).
- Production images, nginx and the one-shot `migrate`/`install` compose services are deferred to a later deployment module.

## Consequences
- One command (reopen in container) gives a working app; deleting the container and its volumes removes everything.
- The repository is bind-mounted, so files edited in the container are the developer's real files; agents in the container can change the repo but not the rest of the host.
- Host-based development (Node and pnpm on the host, `docker compose up -d db`) keeps working but is no longer the documented path.
- The devcontainer image and feature versions need occasional updates.

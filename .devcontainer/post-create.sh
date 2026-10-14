#!/usr/bin/env bash
# Runs once when the devcontainer is created (ADR 0007).
set -euo pipefail

# Named volumes are created root-owned; hand them to the node user.
sudo chown -R node:node \
  node_modules apps/api/node_modules apps/web/node_modules packages/shared/node_modules \
  /home/node/.local /home/node/.claude

sudo corepack enable
CI=true pnpm install --frozen-lockfile

[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env

# Wait for Postgres (shared network namespace: localhost).
timeout 60 bash -c 'until (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null; do sleep 1; done'

# ADR 0006: explicit setup commands; after pulling new code, run them again yourself.
pnpm --filter @offwise/api migration:run
pnpm --filter @offwise/api install:run

echo "offwise devcontainer ready: run 'pnpm dev' (web http://localhost:5173, api http://localhost:3000/api)"

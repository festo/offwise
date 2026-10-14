# 0008: Headless browser for agents (Playwright MCP)

**Status:** Accepted
**Date:** 2026-10-14

## Context
Agents working on `apps/web` can run unit tests and build Storybook, but they cannot see the running app. When a page breaks (a blank screen, a console error, a failed API call through the Vite proxy), they can only guess from the code. The devcontainer (ADR 0007) has no display, so a browser must run headless.

## Decision
- The Playwright MCP server (`@playwright/mcp`, pinned as a root devDependency because it is repo tooling) is registered in the project `.mcp.json` as `playwright` and approved for everyone through `enabledMcpjsonServers` in `.claude/settings.json`.
- It runs Chromium headless with an in-memory profile (`--headless --isolated --browser chromium`). Chromium is used rather than Google Chrome because Chrome has no Linux arm64 build.
- Creating the devcontainer installs the browser and its system libraries (`playwright-mcp install-browser --with-deps chrome-for-testing` in `post-create.sh`), using the Playwright version bundled with the pinned MCP package so browser and driver always match.
- Snapshots, console logs and screenshots go to `.playwright-mcp/`, which is gitignored.

## Consequences
- Agents can open the app at http://localhost:5173, read the page structure and console, and take screenshots while diagnosing UI problems.
- Creating the container downloads the browser (about 400 MB on disk). The browser lives in `~/.cache/ms-playwright`, not in a volume, so a container rebuild downloads it again.
- Upgrading `@playwright/mcp` can change the browser revision; after upgrading, run the `install-browser` command again (or rebuild the container).
- The browser is a test tool only: it has normal network access like the rest of the container, and its profile is discarded when the server stops.

# @offwise/web

Vue 3 SPA for offwise. Read the root `CLAUDE.md` first.

## Stack

Vue 3 (Composition API), Vite, TypeScript, Tailwind, shadcn-vue (https://github.com/unovue/shadcn-vue), Storybook, Vitest + Vue Test Utils.

## Commands

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

## Mobile first

Every screen works on a phone, from the first version of the screen.

- Write styles mobile first: base Tailwind classes target the phone; `sm:`, `md:` and `lg:` add to them. Minimum supported width is 360 px, with no horizontal page scroll.
- Touch targets are at least 44 × 44 px. Form inputs use a font size of at least 16 px (iOS zooms on smaller inputs). Forms are single-column on phones.
- Nothing depends on hover: tooltips, menus and row actions also work by tap.
- Navigation goes off-canvas on small screens; wide tables become stacked cards below `md`.
- Layout-sensitive components have a `Mobile` story that sets Storybook's mobile viewport.
- When checking a page with the Playwright MCP server, check it at 375 px and at a desktop width.

## Storybook

- Every component has a co-located `<Component>.stories.ts` (CSF3): everything in `src/components/` and in `src/features/*/components/`. Shadcn primitives in `src/components/ui/<name>/` need one stories file per folder covering its variants. Pages and `App.vue` are excluded. `src/stories-coverage.spec.ts` fails on any component without a story, so adding a shadcn primitive with the CLI means adding its story in the same change.
- Cover the meaningful states: default, loading, empty, error, and disabled where relevant.
- Stories use static props or mocked data; no real network calls.

## Checking in a browser

The `playwright` MCP server (`.mcp.json`, ADR 0008) drives a headless Chromium inside the devcontainer. With `pnpm dev` running, open http://localhost:5173 to check a page, its console errors and failed requests; use it to diagnose a UI bug before guessing at the fix. Snapshots and screenshots land in `.playwright-mcp/` (gitignored). It complements tests and Storybook; it does not replace them.

## Accessibility

Semantic elements, labelled form controls, full keyboard operability, visible focus states. Prefer the shadcn-vue (Reka UI) primitives, which handle ARIA for dialogs, menus, and popovers.

## Tests

Vitest + Vue Test Utils for component behaviour and composables. Test what the user sees and does (rendered text, emitted events), not internals.

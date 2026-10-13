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

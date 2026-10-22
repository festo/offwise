import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The reka-nova primitives style state with variants such as `data-checked:` and `data-open:`.
// Tailwind's built-in `data-*` variant only matches the bare attribute (`[data-checked]`), but
// Reka UI emits `data-state="checked"` / `data-state="open"`. shadcn-vue ships custom variants
// that bridge the two; without them the Switch track has no colour (invisible on white) and
// dialogs, menus and selects lose their open/close styles.
const STATE_VARIANTS = [
  'data-open',
  'data-closed',
  'data-checked',
  'data-unchecked',
  'data-active',
  'data-disabled',
  'data-selected',
];

const assetsDir = __dirname;
const uiDir = join(assetsDir, '..', 'components', 'ui');
const css = readFileSync(join(assetsDir, 'main.css'), 'utf8');

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return /\.(vue|ts)$/.test(entry.name) ? [path] : [];
  });
}

describe('main.css theme', () => {
  it.each(STATE_VARIANTS)('defines the %s custom variant used by the ui primitives', (variant) => {
    expect(css).toMatch(new RegExp(`@custom-variant ${variant}\\s*\\{`));
  });

  it('maps every state variant to the Reka data-state attribute', () => {
    for (const state of ['open', 'closed', 'checked', 'unchecked', 'active']) {
      expect(css).toMatch(new RegExp(`\\[data-state=['"]${state}['"]\\]`));
    }
  });

  it('covers every state variant the ui primitives use', () => {
    const used = new Set<string>();
    for (const file of vueFiles(uiDir)) {
      for (const match of readFileSync(file, 'utf8').matchAll(
        /(?:^|[\s'"`:-])(data-(?:open|closed|checked|unchecked|active|disabled|selected))(?:\/[\w-]+)?:/g,
      )) {
        used.add(match[1]!);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const variant of used) expect(STATE_VARIANTS).toContain(variant);
  });
});

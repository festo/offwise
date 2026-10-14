import { describe, expect, it } from 'vitest';

// Lazy globs: only the file paths are used, nothing is imported.
const components = Object.keys(
  import.meta.glob(['./components/**/*.vue', './features/*/components/**/*.vue']),
);
const stories = new Set(
  Object.keys(
    import.meta.glob(['./components/**/*.stories.ts', './features/*/components/**/*.stories.ts']),
  ),
);

describe('Storybook coverage', () => {
  it('finds components to check', () => {
    expect(components.length).toBeGreaterThan(0);
  });

  it('has a sibling <Name>.stories.ts for every component', () => {
    const missing = components.filter(
      (path) => !stories.has(path.replace(/\.vue$/, '.stories.ts')),
    );
    expect(missing).toEqual([]);
  });
});

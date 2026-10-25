import { describe, expect, it } from 'vitest';
import { findMissingStories } from './lib/stories-coverage';

// Lazy globs: only the file paths are used, nothing is imported.
const components = Object.keys(
  import.meta.glob(['./components/**/*.vue', './features/*/components/**/*.vue']),
);
const stories = Object.keys(
  import.meta.glob(['./components/**/*.stories.ts', './features/*/components/**/*.stories.ts']),
);

describe('findMissingStories', () => {
  it('requires a sibling <Name>.stories.ts for an ordinary component', () => {
    expect(
      findMissingStories(
        ['./components/AppLayout.vue', './features/auth/components/LoginForm.vue'],
        ['./components/AppLayout.stories.ts'],
      ),
    ).toEqual(['./features/auth/components/LoginForm.vue']);
  });

  it('does not accept another story in the same folder for an ordinary component', () => {
    expect(
      findMissingStories(
        ['./components/AppLayout.vue', './components/UserMenu.vue'],
        ['./components/AppLayout.stories.ts'],
      ),
    ).toEqual(['./components/UserMenu.vue']);
  });

  it('covers every file of a ui/<name>/ primitive with one stories file in that folder', () => {
    expect(
      findMissingStories(
        [
          './components/ui/sidebar/Sidebar.vue',
          './components/ui/sidebar/SidebarMenu.vue',
          './components/ui/button/Button.vue',
        ],
        ['./components/ui/sidebar/Sidebar.stories.ts'],
      ),
    ).toEqual(['./components/ui/button/Button.vue']);
  });

  it('does not let a story in one ui folder cover another ui folder', () => {
    expect(
      findMissingStories(
        ['./components/ui/sheet/Sheet.vue'],
        ['./components/ui/sidebar/Sidebar.stories.ts'],
      ),
    ).toEqual(['./components/ui/sheet/Sheet.vue']);
  });
});

describe('Storybook coverage', () => {
  it('finds components to check', () => {
    expect(components.length).toBeGreaterThan(0);
  });

  it('has a story for every component', () => {
    expect(findMissingStories(components, stories)).toEqual([]);
  });
});

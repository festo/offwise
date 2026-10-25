const UI_FOLDER = /^(.*\/components\/ui\/[^/]+)\//;

/**
 * Returns the components that have no story.
 *
 * - A shadcn primitive under `components/ui/<name>/` is covered by any `*.stories.ts` in that
 *   folder (composite primitives such as Sidebar ship many `.vue` files).
 * - Every other component needs a sibling `<Name>.stories.ts`.
 */
export function findMissingStories(components: string[], stories: string[]): string[] {
  const storySet = new Set(stories);
  const uiFoldersWithStories = new Set(
    stories.map((path) => UI_FOLDER.exec(path)?.[1]).filter((folder) => folder !== undefined),
  );

  return components.filter((path) => {
    const uiFolder = UI_FOLDER.exec(path)?.[1];
    if (uiFolder !== undefined) return !uiFoldersWithStories.has(uiFolder);
    return !storySet.has(path.replace(/\.vue$/, '.stories.ts'));
  });
}

import { fileURLToPath, URL } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC instead of esbuild: Nest dependency injection needs emitDecoratorMetadata.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      // Tests use the shared source, so they never depend on a stale packages/shared/dist.
      '@offwise/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    // The e2e project shares one test database, so test files run one at a time
    // (not configurable per project in vitest 3).
    fileParallelism: false,
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          setupFiles: ['test/setup-env.ts'],
          globalSetup: ['test/global-setup.ts'],
        },
      },
    ],
  },
});

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
    projects: [{ extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } }],
  },
});

import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  framework: { name: '@storybook/vue3-vite', options: {} },
  // Self-hosted, privacy-first project: never send usage data to Storybook.
  core: { disableTelemetry: true },
};

export default config;

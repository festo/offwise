import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';

export default defineConfigWithVueTs(
  { ignores: ['dist', 'coverage', 'storybook-static'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    // shadcn-vue primitives use single-word names (Badge, Button) and leave optional props
    // such as `class` without defaults.
    files: ['src/components/ui/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off', 'vue/require-default-prop': 'off' },
  },
);

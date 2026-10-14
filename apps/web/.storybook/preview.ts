import { setup, type Preview } from '@storybook/vue3-vite';
import { i18n } from '../src/i18n';
import '../src/assets/main.css';

setup((app) => {
  app.use(i18n);
});

const preview: Preview = {
  parameters: { layout: 'centered' },
};

export default preview;

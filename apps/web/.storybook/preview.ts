import { setup, type Preview } from '@storybook/vue3-vite';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../src/i18n';
import '../src/assets/main.css';

// Stories never load real pages: a memory router with placeholder routes lets components
// that render RouterLink (AppLayout, UserTable) work in isolation.
const placeholder = { template: '<div />' };
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: placeholder },
    { path: '/admin/users', name: 'users', component: placeholder },
    { path: '/admin/users/:id', name: 'user-edit', component: placeholder },
    { path: '/:pathMatch(.*)*', component: placeholder },
  ],
});

setup((app) => {
  app.use(i18n);
  app.use(router);
});

const preview: Preview = {
  parameters: {
    layout: 'centered',
    viewport: {
      options: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' }, type: 'mobile' },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
      },
    },
  },
};

export default preview;

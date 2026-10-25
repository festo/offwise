import { createApp } from 'vue';
import App from './App.vue';
import './assets/main.css';
import { useSession } from './features/auth/composables/useSession';
import { i18n } from './i18n';
import { onUnauthorized } from './lib/api';
import { router } from './router';

onUnauthorized(() => {
  useSession().clear();
  const current = router.currentRoute.value;
  if (current.name === 'login') return;
  void router.push({ name: 'login', query: { redirect: current.fullPath } });
});

createApp(App).use(router).use(i18n).mount('#app');

import { createRouter, createWebHistory } from 'vue-router';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage.vue';
import HomePage from '@/pages/HomePage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import ResetPasswordPage from '@/pages/ResetPasswordPage.vue';
import SessionErrorPage from '@/pages/SessionErrorPage.vue';
import UserEditPage from '@/pages/UserEditPage.vue';
import UserNewPage from '@/pages/UserNewPage.vue';
import UsersPage from '@/pages/UsersPage.vue';
import { installGuards } from './guards';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { public: true, guestOnly: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordPage,
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: ResetPasswordPage,
      meta: { public: true },
    },
    {
      // Shown when the session could not be loaded for a protected page.
      path: '/error',
      name: 'session-error',
      component: SessionErrorPage,
      meta: { public: true },
    },
    { path: '/', name: 'home', component: HomePage },
    { path: '/admin/users', name: 'users', component: UsersPage, meta: { admin: true } },
    { path: '/admin/users/new', name: 'user-new', component: UserNewPage, meta: { admin: true } },
    { path: '/admin/users/:id', name: 'user-edit', component: UserEditPage, meta: { admin: true } },
  ],
});

installGuards(router);

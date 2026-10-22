import type { Router } from 'vue-router';
import { useSession } from '@/features/auth/composables/useSession';

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without signing in. */
    public?: boolean;
    /** Only for signed-out users; signed-in users go home. */
    guestOnly?: boolean;
    /** Only for admins. */
    admin?: boolean;
  }
}

/** Accepts only paths inside the app; anything else becomes `/`. */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (/[\u0000-\u001f\u007f]/.test(value)) return '/';
  return value;
}

type GuardSession = Pick<ReturnType<typeof useSession>, 'user' | 'loaded' | 'isAdmin' | 'load'>;

export function installGuards(router: Router, session: GuardSession = useSession()): void {
  router.beforeEach(async (to) => {
    if (!session.loaded.value) {
      try {
        await session.load();
      } catch {
        // The session is unknown (server error, network down). Public pages work signed out;
        // protected ones show the error page, whose Retry navigates back and loads again.
        if (!to.meta.public) return { name: 'session-error', query: { redirect: to.fullPath } };
      }
    }

    if (to.meta.public) {
      if (to.meta.guestOnly && session.user.value) return { name: 'home' };
      return true;
    }
    if (!session.user.value) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (to.meta.admin && !session.isAdmin.value) return { name: 'home' };
    return true;
  });
}

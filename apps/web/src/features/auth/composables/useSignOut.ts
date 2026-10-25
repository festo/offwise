import { useRouter } from 'vue-router';
import { useSession } from './useSession';

/**
 * Signs out and goes to the login page. If the logout request fails (server error, offline),
 * the session is still forgotten locally: the user asked to leave, so never strand them.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const session = useSession();

  return async function signOut() {
    try {
      await session.logout();
    } catch {
      session.clear();
    }
    await router.replace({ name: 'login' });
  };
}

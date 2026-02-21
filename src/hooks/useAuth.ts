// React hook for auth store
import { useSyncExternalStore, useCallback } from 'react';
import { authStore } from '../stores/authStore';
import type { AuthUser } from '../stores/authStore';

export function useAuth() {
  const user = useSyncExternalStore(
    (callback) => authStore.subscribe(callback),
    () => authStore.user
  );

  const authenticated = useSyncExternalStore(
    (callback) => authStore.subscribe(callback),
    () => authStore.authenticated
  );

  const login = useCallback(
    (username: string, password: string): Promise<boolean> => {
      return authStore.login(username, password);
    },
    []
  );

  const logout = useCallback(() => {
    authStore.logout();
  }, []);

  return {
    user: user as AuthUser | null,
    authenticated,
    login,
    logout,
  };
}

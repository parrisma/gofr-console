// React hook for token store
import { useSyncExternalStore, useCallback } from 'react';
import { tokenStore } from '../stores/tokenStore';
import type { JwtToken } from '../types/uiConfig';

export function useTokens() {
  const tokens = useSyncExternalStore(
    (callback) => tokenStore.subscribe(callback),
    () => tokenStore.tokens
  );

  const addToken = useCallback((token: JwtToken) => {
    tokenStore.addToken(token);
  }, []);

  const updateToken = useCallback((index: number, token: JwtToken) => {
    tokenStore.updateToken(index, token);
  }, []);

  const deleteToken = useCallback((index: number) => {
    tokenStore.deleteToken(index);
  }, []);

  return {
    tokens,
    addToken,
    updateToken,
    deleteToken,
  };
}

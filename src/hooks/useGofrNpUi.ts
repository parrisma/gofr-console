import { useSyncExternalStore } from 'react';

import { gofrNpUiStore } from '../stores/gofrNpUiStore';

export function useGofrNpUi() {
  const state = useSyncExternalStore(gofrNpUiStore.subscribe, gofrNpUiStore.getState);
  return {
    state,
    setState: gofrNpUiStore.setState,
    reset: gofrNpUiStore.reset,
  };
}

import { useSyncExternalStore } from 'react';

import { gofrDocUiStore } from '../stores/gofrDocUiStore';

export function useGofrDocUi() {
  const state = useSyncExternalStore(gofrDocUiStore.subscribe, gofrDocUiStore.getState);
  return {
    state,
    setState: gofrDocUiStore.setState,
    reset: gofrDocUiStore.reset,
  };
}

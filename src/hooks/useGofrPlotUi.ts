import { useSyncExternalStore } from 'react';

import { gofrPlotUiStore } from '../stores/gofrPlotUiStore';

export function useGofrPlotUi() {
  const state = useSyncExternalStore(gofrPlotUiStore.subscribe, gofrPlotUiStore.getState);
  return {
    state,
    setState: gofrPlotUiStore.setState,
    reset: gofrPlotUiStore.reset,
  };
}

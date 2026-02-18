export interface GofrPlotUiState {
  selectedTokenIndex: number;
  selectedTheme: string;
  selectedHandler: string;
  selectedPlotIdentifier: string;
  targetDocSessionId: string;
}

const defaultState: GofrPlotUiState = {
  selectedTokenIndex: -1,
  selectedTheme: '',
  selectedHandler: '',
  selectedPlotIdentifier: '',
  targetDocSessionId: '',
};

let state: GofrPlotUiState = { ...defaultState };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export const gofrPlotUiStore = {
  getState(): GofrPlotUiState {
    return state;
  },

  setState(patch: Partial<GofrPlotUiState>): void {
    state = { ...state, ...patch };
    emit();
  },

  reset(): void {
    state = { ...defaultState };
    emit();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export interface GofrDocUiState {
  selectedTokenIndex: number;
  sessionId: string;
  templateId: string;
  styleId: string;
}

const defaultState: GofrDocUiState = {
  selectedTokenIndex: -1,
  sessionId: '',
  templateId: '',
  styleId: '',
};

let state: GofrDocUiState = { ...defaultState };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export const gofrDocUiStore = {
  getState(): GofrDocUiState {
    return state;
  },

  setState(patch: Partial<GofrDocUiState>): void {
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

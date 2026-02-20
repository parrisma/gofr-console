export type GofrNpToolName =
  | 'ping'
  | 'math_list_operations'
  | 'math_compute'
  | 'curve_fit'
  | 'curve_predict'
  | 'financial_pv'
  | 'financial_convert_rate'
  | 'financial_option_price'
  | 'financial_bond_price'
  | 'financial_technical_indicators';

export interface CurveFitUiState {
  model_id: string;
  model_type?: string;
  equation?: string;
}

export interface GofrNpUiState {
  selectedTool: GofrNpToolName;
  selectedTokenIndex: number;
  perToolPayloadJson: Partial<Record<GofrNpToolName, string>>;
  lastCurveFit: CurveFitUiState | null;
}

const defaultState: GofrNpUiState = {
  selectedTool: 'math_compute',
  selectedTokenIndex: -1,
  perToolPayloadJson: {},
  lastCurveFit: null,
};

let state: GofrNpUiState = { ...defaultState };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export const gofrNpUiStore = {
  getState(): GofrNpUiState {
    return state;
  },

  setState(patch: Partial<GofrNpUiState>): void {
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

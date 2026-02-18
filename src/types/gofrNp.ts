export interface NpPingResponse {
  status: string;
  service?: string;
}

export interface NpMathResult<T = unknown> {
  result: T;
  shape?: number[];
  dtype?: string;
}

export interface NpErrorResponse {
  error: string;
}

export interface NpMathListOperationsResponse {
  unary?: string[];
  binary?: string[];
}

export interface NpCurveFitQuality {
  r_squared?: number;
  rmse?: number;
  aic?: number;
}

export interface NpCurveFitResponse {
  model_id: string;
  model_type?: string;
  equation?: string;
  parameters?: number[];
  quality?: NpCurveFitQuality;
  data_points?: number;
  outliers_removed?: number;
}

export interface NpFinancialPvResponse {
  present_value?: number;
  discounted_flows?: number[];
  total_undiscounted?: number;
  effective_rates?: number[];
  times?: number[];
  [key: string]: unknown;
}

export interface NpFinancialConvertRateResponse {
  converted_rate?: number;
  effective_annual_rate?: number;
  from_frequency?: string;
  to_frequency?: string;
  [key: string]: unknown;
}

export interface NpFinancialOptionPriceResponse {
  price?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  model?: string;
  steps?: number;
  [key: string]: unknown;
}

export interface NpFinancialBondPriceResponse {
  price?: number;
  macaulay_duration?: number;
  modified_duration?: number;
  convexity?: number;
  face_value?: number;
  coupon_rate?: number;
  yield_to_maturity?: number;
  [key: string]: unknown;
}

export type NpFinancialTechnicalIndicatorsResponse = Record<string, unknown>;

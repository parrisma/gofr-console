import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { api } from '../services/api';
import { logger } from '../services/logging';
import { formatJson } from '../utils/jsonHighlight';
import { useGofrNpUi } from '../hooks/useGofrNpUi';
import { useTokens } from '../hooks/useTokens';
import type { GofrNpToolName } from '../stores/gofrNpUiStore';
import RequestPreview from '../components/common/RequestPreview';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import RawResponsePopupIcon from '../components/common/RawResponsePopupIcon';
import JsonBlock from '../components/common/JsonBlock';
import { guardNpToolArgs } from '../utils/npPayloadGuards';
import TokenSelect from '../components/common/TokenSelect';

type ToolDocParam = {
  name: string;
  required: boolean;
  type: string;
  default?: string;
  description: string;
};

type ToolDoc = {
  tool: GofrNpToolName;
  title: string;
  what: string;
  how: string;
  params: ToolDocParam[];
  returns: string;
  notes?: string[];
  examples: Array<{ label: string; json: string }>;
};

const TOOL_ORDER: GofrNpToolName[] = [
  'ping',
  'math_list_operations',
  'math_compute',
  'curve_fit',
  'curve_predict',
  'financial_pv',
  'financial_convert_rate',
  'financial_option_price',
  'financial_bond_price',
  'financial_technical_indicators',
];

const TOOL_DOCS: Record<GofrNpToolName, ToolDoc> = {
  ping: {
    tool: 'ping',
    title: 'ping',
    what: 'Health check for gofr-np MCP server.',
    how: 'Server returns a simple status payload when reachable.',
    params: [],
    returns: 'Plain object: {status, service}',
    examples: [{ label: 'Empty args', json: '{}' }],
  },
  math_list_operations: {
    tool: 'math_list_operations',
    title: 'math_list_operations',
    what: 'List supported element-wise operations.',
    how: 'Returns two lists: unary operations and binary operations.',
    params: [],
    returns: 'Plain object: {unary: string[], binary: string[]}',
    examples: [{ label: 'Empty args', json: '{}' }],
  },
  math_compute: {
    tool: 'math_compute',
    title: 'math_compute',
    what: 'Perform element-wise mathematical operations on scalars or arrays with broadcasting.',
    how: 'Applies broadcasting rules (scalar expands to match arrays; compatible dimensions expand). Computes with float32/float64 precision.',
    params: [
      { name: 'operation', required: true, type: 'string', description: 'Operation name (see math_list_operations).' },
      { name: 'a', required: true, type: 'number|array', description: 'First operand (scalar or nested arrays).' },
      { name: 'b', required: false, type: 'number|array', description: 'Second operand for binary ops.' },
      { name: 'precision', required: false, type: 'string', default: 'float64', description: 'float32 or float64.' },
    ],
    returns: 'MathResult wrapper: {result, shape, dtype}',
    examples: [
      { label: 'Unary abs', json: '{\n  "operation": "abs",\n  "a": [-1, 2, -3]\n}' },
      { label: 'Binary add with broadcast scalar', json: '{\n  "operation": "add",\n  "a": [1, 2, 3],\n  "b": 10\n}' },
    ],
  },
  curve_fit: {
    tool: 'curve_fit',
    title: 'curve_fit',
    what: 'Fit a model to X/Y data with model selection and robust outlier handling.',
    how: 'Tries candidate models (or multiple for auto), removes outliers, and selects a best model by quality metrics.',
    params: [
      { name: 'x', required: true, type: 'number[]', description: 'X coordinates.' },
      { name: 'y', required: true, type: 'number[]', description: 'Y coordinates (same length as x).' },
      { name: 'model_type', required: false, type: 'string', default: 'auto', description: 'auto|polynomial|exponential|logarithmic|power|sigmoid' },
      { name: 'degree', required: false, type: 'integer', description: 'Polynomial degree (only for polynomial).' },
    ],
    returns: 'Plain object: {model_id, model_type, equation, parameters, quality, data_points, outliers_removed}',
    notes: ['model_id is in-memory only; run curve_predict right after curve_fit.'],
    examples: [
      { label: 'Auto fit', json: '{\n  "x": [1, 2, 3, 4, 5],\n  "y": [2, 4, 6.1, 8.2, 10],\n  "model_type": "auto"\n}' },
    ],
  },
  curve_predict: {
    tool: 'curve_predict',
    title: 'curve_predict',
    what: 'Predict Y values for new X values using a previously fitted model.',
    how: 'Evaluates the fitted model on new inputs. The model_id is stored in memory on the server.',
    params: [
      { name: 'model_id', required: true, type: 'string', description: 'Model id returned by curve_fit.' },
      { name: 'x', required: true, type: 'number[]', description: 'X values to predict.' },
    ],
    returns: 'MathResult wrapper: {result, shape, dtype} (result is numeric array)',
    examples: [
      { label: 'Predict (model_id filled after fit)', json: '{\n  "model_id": "<set after curve_fit>",\n  "x": [6, 7, 8]\n}' },
    ],
  },
  financial_pv: {
    tool: 'financial_pv',
    title: 'financial_pv',
    what: 'Calculate present value of cash flows using a scalar rate or a per-period yield curve.',
    how: 'Computes discount factors using discrete or continuous compounding, then sums discounted flows.',
    params: [
      { name: 'cash_flows', required: true, type: 'number[]', description: 'Cash flow amounts.' },
      { name: 'rate', required: true, type: 'number|number[]', description: 'Scalar rate or yield curve matching cash_flows length.' },
      { name: 'times', required: false, type: 'number[]', description: 'Optional times; defaults to 1..N.' },
      { name: 'compounding', required: false, type: 'string', default: 'discrete', description: 'discrete|continuous' },
    ],
    returns: 'Plain object: {present_value, discounted_flows, total_undiscounted, effective_rates, times}',
    examples: [
      { label: 'PV with scalar rate', json: '{\n  "cash_flows": [-100, 30, 40, 50],\n  "rate": 0.05,\n  "compounding": "discrete"\n}' },
    ],
  },
  financial_convert_rate: {
    tool: 'financial_convert_rate',
    title: 'financial_convert_rate',
    what: 'Convert an interest rate between compounding conventions.',
    how: 'Uses effective annual rate as an intermediate representation.',
    params: [
      { name: 'rate', required: true, type: 'number', description: 'Rate to convert.' },
      { name: 'from_freq', required: true, type: 'string', description: 'annual|semiannual|quarterly|monthly|weekly|daily|continuous|simple' },
      { name: 'to_freq', required: true, type: 'string', description: 'Target frequency (same enum as from_freq).' },
    ],
    returns: 'Plain object: {converted_rate, effective_annual_rate, from_frequency, to_frequency}',
    examples: [
      { label: 'Annual to monthly', json: '{\n  "rate": 0.05,\n  "from_freq": "annual",\n  "to_freq": "monthly"\n}' },
    ],
  },
  financial_option_price: {
    tool: 'financial_option_price',
    title: 'financial_option_price',
    what: 'Price an option and compute Greeks using a CRR binomial tree.',
    how: 'Builds a recombining binomial tree; values payoffs at maturity and backward-inducts. American options allow early exercise.',
    params: [
      { name: 'S', required: true, type: 'number', description: 'Spot price.' },
      { name: 'K', required: true, type: 'number', description: 'Strike price.' },
      { name: 'T', required: true, type: 'number', description: 'Time to maturity in years.' },
      { name: 'r', required: true, type: 'number', description: 'Risk-free rate.' },
      { name: 'sigma', required: true, type: 'number', description: 'Volatility.' },
      { name: 'option_type', required: true, type: 'string', description: 'call|put' },
      { name: 'exercise_style', required: true, type: 'string', description: 'european|american' },
      { name: 'steps', required: false, type: 'integer', default: '100', description: 'Binomial steps.' },
      { name: 'q', required: false, type: 'number', default: '0.0', description: 'Dividend yield.' },
      { name: 'dividends', required: false, type: 'object[]', description: 'Discrete dividends: [{amount, time}, ...].' },
    ],
    returns: 'Plain object: {price, delta, gamma, theta, vega, rho, model, steps}',
    examples: [
      { label: 'European call', json: '{\n  "S": 100,\n  "K": 100,\n  "T": 1,\n  "r": 0.03,\n  "sigma": 0.2,\n  "option_type": "call",\n  "exercise_style": "european",\n  "steps": 100\n}' },
    ],
  },
  financial_bond_price: {
    tool: 'financial_bond_price',
    title: 'financial_bond_price',
    what: 'Compute bond price and risk metrics (duration/convexity).',
    how: 'Discounts coupon and principal cash flows and computes duration/convexity from discounted timing.',
    params: [
      { name: 'face_value', required: false, type: 'number', default: '100.0', description: 'Face value.' },
      { name: 'coupon_rate', required: true, type: 'number', description: 'Annual coupon rate (decimal).' },
      { name: 'years_to_maturity', required: true, type: 'number', description: 'Years to maturity.' },
      { name: 'yield_to_maturity', required: true, type: 'number', description: 'Yield to maturity (decimal).' },
      { name: 'frequency', required: false, type: 'integer', default: '2', description: 'Coupons per year.' },
    ],
    returns: 'Plain object: {price, macaulay_duration, modified_duration, convexity, ...}',
    examples: [
      { label: 'Bond metrics', json: '{\n  "coupon_rate": 0.05,\n  "years_to_maturity": 10,\n  "yield_to_maturity": 0.04,\n  "frequency": 2\n}' },
    ],
  },
  financial_technical_indicators: {
    tool: 'financial_technical_indicators',
    title: 'financial_technical_indicators',
    what: 'Compute technical analysis indicators over a price series.',
    how: 'Applies standard indicator formulas over the provided prices; parameters are passed via params.',
    params: [
      { name: 'indicator', required: true, type: 'string', description: 'Schema advertises sma|ema|rsi|pe_ratio (implementation also supports macd, bollinger, cross_signal).' },
      { name: 'prices', required: false, type: 'number[]', description: 'Required for time-series indicators.' },
      { name: 'params', required: false, type: 'object', default: '{}', description: 'Indicator-specific params.' },
    ],
    returns: 'Plain object: indicator outputs and metadata.',
    examples: [
      { label: 'SMA(window=3)', json: '{\n  "indicator": "sma",\n  "prices": [1, 2, 3, 4, 5, 6],\n  "params": {"window": 3}\n}' },
    ],
  },
};

const DEFAULT_PAYLOADS: Record<GofrNpToolName, string> = {
  ping: '{}',
  math_list_operations: '{}',
  math_compute: '{\n  "operation": "add",\n  "a": [1, 2, 3],\n  "b": 10\n}',
  curve_fit: '{\n  "x": [1, 2, 3, 4, 5],\n  "y": [2, 4, 6.1, 8.2, 10],\n  "model_type": "auto"\n}',
  curve_predict: '{\n  "model_id": "<set after curve_fit>",\n  "x": [6, 7, 8]\n}',
  financial_pv: '{\n  "cash_flows": [-100, 30, 40, 50],\n  "rate": 0.05,\n  "compounding": "discrete"\n}',
  financial_convert_rate: '{\n  "rate": 0.05,\n  "from_freq": "annual",\n  "to_freq": "monthly"\n}',
  financial_option_price: '{\n  "S": 100,\n  "K": 100,\n  "T": 1,\n  "r": 0.03,\n  "sigma": 0.2,\n  "option_type": "call",\n  "exercise_style": "european",\n  "steps": 100\n}',
  financial_bond_price: '{\n  "coupon_rate": 0.05,\n  "years_to_maturity": 10,\n  "yield_to_maturity": 0.04,\n  "frequency": 2\n}',
  financial_technical_indicators: '{\n  "indicator": "sma",\n  "prices": [1, 2, 3, 4, 5, 6],\n  "params": {"window": 3}\n}',
};

function formatPreview(value: unknown, maxItems = 24): unknown {
  if (Array.isArray(value)) {
    if (value.length <= maxItems) return value;
    return [...value.slice(0, maxItems), `...[${value.length - maxItems} more]`];
  }
  return value;
}

function hasMathResultShape(value: unknown): value is { result: unknown; shape?: unknown; dtype?: unknown } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return 'result' in v && ('dtype' in v || 'shape' in v);
}

export default function GofrNpTools() {
  const { state: uiState, setState: setUiState } = useGofrNpUi();
  const { tokens } = useTokens();

  const [payloadJson, setPayloadJson] = useState<string>(() => {
    return uiState.perToolPayloadJson[uiState.selectedTool] ?? DEFAULT_PAYLOADS[uiState.selectedTool];
  });

  const [validateErr, setValidateErr] = useState<unknown>(null);

  const [runLoading, setRunLoading] = useState(false);
  const [runErr, setRunErr] = useState<unknown>(null);
  const [runRes, setRunRes] = useState<unknown>(null);

  const [opsLoading, setOpsLoading] = useState(false);
  const [opsErr, setOpsErr] = useState<unknown>(null);
  const [opsRes, setOpsRes] = useState<unknown>(null);

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-NP Tools page viewed',
      component: 'GofrNpTools',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  // Prefer a reasonable default token when available.
  useEffect(() => {
    if (uiState.selectedTokenIndex >= 0) return;
    if (!tokens || tokens.length === 0) return;

    const preferredIndex = Math.max(
      0,
      tokens.findIndex((t) => t.name === 'all') >= 0
        ? tokens.findIndex((t) => t.name === 'all')
        : tokens.findIndex((t) => t.name === 'admin'),
    );
    setUiState({ selectedTokenIndex: preferredIndex });
  }, [setUiState, tokens, uiState.selectedTokenIndex]);

  const selectedDoc = TOOL_DOCS[uiState.selectedTool];

  const prevSelectedToolRef = useRef<GofrNpToolName>(uiState.selectedTool);

  useEffect(() => {
    // Only reset editor/output when switching tools.
    // Saving per-tool payload JSON also updates uiState.perToolPayloadJson, and should not wipe outputs.
    if (prevSelectedToolRef.current === uiState.selectedTool) return;
    prevSelectedToolRef.current = uiState.selectedTool;

    const existing = uiState.perToolPayloadJson[uiState.selectedTool];
    const next = existing ?? DEFAULT_PAYLOADS[uiState.selectedTool];
    setPayloadJson(next);
    setValidateErr(null);
    setRunErr(null);
    setRunRes(null);
  }, [uiState.selectedTool, uiState.perToolPayloadJson]);

  const parsePayload = (): Record<string, unknown> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadJson);
    } catch (e) {
      throw (e instanceof Error ? e : new Error(String(e)));
    }

    guardNpToolArgs(parsed);
    return parsed as Record<string, unknown>;
  };

  const validateJson = () => {
    setValidateErr(null);
    try {
      parsePayload();
      setPayloadJson(formatJson(payloadJson));
    } catch (e) {
      setValidateErr(e);
    }
  };

  const runTool = async () => {
    const tool = uiState.selectedTool;

    const selectedToken =
      uiState.selectedTokenIndex >= 0 && uiState.selectedTokenIndex < tokens.length
        ? tokens.at(uiState.selectedTokenIndex) ?? null
        : null;
    const authToken = selectedToken?.token || undefined;

    const toolRequiresAuth = tool !== 'ping' && tool !== 'math_list_operations';
    if (toolRequiresAuth && !authToken) {
      setRunErr(new Error('Auth required: select a JWT token'));
      return;
    }

    // Curve predict is in-memory and should be gated in UI session.
    if (tool === 'curve_predict' && !uiState.lastCurveFit?.model_id) {
      setRunErr(new Error('curve_predict is blocked until curve_fit succeeds (model_id is in-memory)'));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setRunLoading(true);
    setRunErr(null);
    setRunRes(null);

    try {
      const args = parsePayload();

      // Auto-fill model_id if curve_predict and we have lastCurveFit
      if (tool === 'curve_predict' && uiState.lastCurveFit?.model_id) {
        args.model_id = uiState.lastCurveFit.model_id;
      }

      let res: unknown;
      switch (tool) {
        case 'ping':
          res = await api.npPing();
          break;
        case 'math_list_operations':
          res = await api.npMathListOperations();
          break;
        case 'math_compute':
          res = await api.npMathCompute(args, authToken);
          break;
        case 'curve_fit':
          res = await api.npCurveFit(args, authToken);
          break;
        case 'curve_predict':
          res = await api.npCurvePredict(args, authToken);
          break;
        case 'financial_pv':
          res = await api.npFinancialPv(args, authToken);
          break;
        case 'financial_convert_rate':
          res = await api.npFinancialConvertRate(args, authToken);
          break;
        case 'financial_option_price':
          res = await api.npFinancialOptionPrice(args, authToken);
          break;
        case 'financial_bond_price':
          res = await api.npFinancialBondPrice(args, authToken);
          break;
        case 'financial_technical_indicators':
          res = await api.npFinancialTechnicalIndicators(args, authToken);
          break;
      }

      setRunRes(res);

      // Save payload per tool
      setUiState({
        perToolPayloadJson: {
          ...uiState.perToolPayloadJson,
          [tool]: payloadJson,
        },
      });

      // Persist curve_fit model_id in UI state
      if (tool === 'curve_fit' && res && typeof res === 'object') {
        const obj = res as Record<string, unknown>;
        const modelId = obj.model_id;
        if (typeof modelId === 'string' && modelId.trim()) {
          setUiState({
            lastCurveFit: {
              model_id: modelId,
              model_type: typeof obj.model_type === 'string' ? obj.model_type : undefined,
              equation: typeof obj.equation === 'string' ? obj.equation : undefined,
            },
          });
        }
      }

      logger.info({
        event: 'ui_form_submitted',
        message: `${tool} succeeded`,
        request_id: requestId,
        component: 'GofrNpTools',
        operation: tool,
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setRunErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: `${tool} failed`,
        request_id: requestId,
        component: 'GofrNpTools',
        operation: tool,
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setRunLoading(false);
    }
  };

  const loadOperations = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setOpsLoading(true);
    setOpsErr(null);
    setOpsRes(null);

    try {
      const res = await api.npMathListOperations();
      setOpsRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'math_list_operations succeeded (ops helper)',
        request_id: requestId,
        component: 'GofrNpTools',
        operation: 'math_list_operations',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setOpsErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'math_list_operations failed (ops helper)',
        request_id: requestId,
        component: 'GofrNpTools',
        operation: 'math_list_operations',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setOpsLoading(false);
    }
  };

  const structuredOutput = useMemo(() => {
    if (!runRes || typeof runRes !== 'object') return null;

    if (hasMathResultShape(runRes)) {
      const obj = runRes as Record<string, unknown>;
      const dtype = typeof obj.dtype === 'string' ? obj.dtype : undefined;
      const shape = Array.isArray(obj.shape) ? (obj.shape as number[]) : undefined;
      return {
        dtype,
        shape,
        result_preview: formatPreview(obj.result),
      };
    }

    return runRes;
  }, [runRes]);

  const curvePredictBlocked = uiState.selectedTool === 'curve_predict' && !uiState.lastCurveFit?.model_id;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GOFR-NP Tools
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select a function and run it by editing the JSON payload. Most tools require a JWT token.
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tool selector
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              label="tool"
              value={uiState.selectedTool}
              onChange={(e) => setUiState({ selectedTool: e.target.value as GofrNpToolName })}
              sx={{ minWidth: 360 }}
              size="small"
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              {TOOL_ORDER.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </TextField>

            {uiState.selectedTool === 'math_compute' ? (
              <>
                <Button
                  variant="outlined"
                  onClick={loadOperations}
                  disabled={opsLoading}
                  startIcon={opsLoading ? <CircularProgress size={16} /> : undefined}
                >
                  {opsLoading ? 'Loading…' : 'List operations'}
                </Button>
                <RequestPreview tool="math_list_operations" args={{}} />
                <RawResponsePopupIcon title="math_list_operations raw" data={opsRes ?? opsErr ?? null} />
              </>
            ) : null}

            <TokenSelect
              label="JWT"
              tokens={tokens}
              value={uiState.selectedTokenIndex}
              onChange={(idx) => setUiState({ selectedTokenIndex: idx })}
              allowNone={true}
              helperText={tokens.length === 0 ? 'Add a token in Operations to run auth-required tools' : undefined}
              sx={{ ml: 'auto' }}
            />
          </Box>

          {opsErr ? <ToolErrorAlert err={opsErr} fallback="math_list_operations failed" /> : null}

          {uiState.lastCurveFit?.model_id ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Last curve_fit model_id (in-memory): {uiState.lastCurveFit.model_id}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tool details
          </Typography>

          <Typography variant="subtitle2">What it does</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {selectedDoc.what}
          </Typography>

          <Typography variant="subtitle2">How it works</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {selectedDoc.how}
          </Typography>

          {selectedDoc.notes?.length ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {selectedDoc.notes.join(' ')}
            </Alert>
          ) : null}

          <Typography variant="subtitle2" gutterBottom>
            Parameters
          </Typography>

          {selectedDoc.params.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>name</strong></TableCell>
                  <TableCell width={80}><strong>required</strong></TableCell>
                  <TableCell width={140}><strong>type</strong></TableCell>
                  <TableCell width={120}><strong>default</strong></TableCell>
                  <TableCell><strong>description</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedDoc.params.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.required ? 'yes' : 'no'}</TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell>{p.default ?? ''}</TableCell>
                    <TableCell>{p.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No parameters.
            </Typography>
          )}

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Returns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedDoc.returns}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>
            Examples
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {selectedDoc.examples.map((ex) => (
              <Button
                key={ex.label}
                variant="outlined"
                size="small"
                onClick={() => setPayloadJson(ex.json)}
              >
                {ex.label}
              </Button>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6">Tool input</Typography>
            <RawResponsePopupIcon title="Raw tool response" data={runRes} />
          </Box>

          <TextField
            label="arguments (JSON)"
            value={payloadJson}
            onChange={(e) => setPayloadJson(e.target.value)}
            fullWidth
            multiline
            minRows={8}
            sx={{ mt: 2 }}
          />

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={validateJson}>
              Validate JSON
            </Button>
            <Button
              variant="contained"
              onClick={runTool}
              disabled={runLoading || curvePredictBlocked}
              startIcon={runLoading ? <CircularProgress size={16} /> : undefined}
            >
              {runLoading ? 'Running…' : 'Run tool'}
            </Button>
            <RequestPreview tool={uiState.selectedTool} args={{ '(see JSON editor)': true }} />
          </Box>

          {curvePredictBlocked ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              curve_predict is blocked until curve_fit succeeds in this UI session.
            </Alert>
          ) : null}

          {validateErr ? <ToolErrorAlert err={validateErr} fallback="Invalid JSON" /> : null}
          {runErr ? <ToolErrorAlert err={runErr} fallback="Tool failed" /> : null}

          {runRes ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Output
              </Typography>
              <JsonBlock data={structuredOutput} copyLabel="Copy output" maxHeight={420} />
            </Box>
          ) : null}

          <Alert severity="info" sx={{ mt: 2 }}>
            Response shapes: tools may return a plain object, or a MathResult wrapper {'{'}"result", "shape", "dtype"{'}'}. Errors may return {'{'}"error": "..."{'}'}.
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}

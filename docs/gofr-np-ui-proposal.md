# Proposal: GOFR-NP UI (numpy MCP math utility)

Purpose
- Provide a simple, reliable UI for invoking gofr-np MCP math tools.
- Users select a function/tool, then enter parameters by editing a JSON payload.
- For each function, show clear details: what it does, how it works, parameters, and return shapes.

Scope
- Only the UX needed to run tools safely and understand inputs/outputs.
- No new backend endpoints.
- No complex form builders; JSON payload is the primary input method.

High-level UX

1) Navigation
- Add a GOFR-NP module (similar to GOFR-DOC / GOFR-PLOT).
- Pages:
  - Health
  - Tools (single tool runner page)

2) Page: GOFR-NP Health
- Goal: confirm connectivity.
- Controls:
  - Run Health Check button.
- Calls:
  - ping
- Output:
  - JSON response
  - Error alert on failure

3) Page: GOFR-NP Tools (tool runner)

Layout (cards)
A) Tool selector
- Dropdown or table to select a tool/function:
  - ping
  - math_list_operations
  - math_compute
  - curve_fit
  - curve_predict
  - financial_pv
  - financial_convert_rate
  - financial_option_price
  - financial_bond_price
  - financial_technical_indicators

B) Tool details (read-only)
- Displays the selected tool documentation:
  - What it does
  - How it works (conceptual)
  - Parameters (required/optional, types, defaults)
  - Returns (plain object vs MathResult wrapper)
  - Common errors
  - Example JSON payload(s)
- Also show the "Response Shape Notes" at the top of this panel:
  - Plain object vs MathResult wrapper
  - Error shape: {"error": "..."}

C) Tool input (JSON)
- Multiline JSON editor (TextField multiline) containing "arguments" for tools/call.
- Buttons:
  - Validate JSON (client-side parse only)
  - Run tool
- Request preview panel shows:
  - tool name
  - sanitized arguments (no tokens)

D) Output
- RawResponsePopupIcon
- Structured output display:
  - If response is MathResult wrapper: show dtype + shape + a truncated preview of result
  - If response is plain object: show JSON
  - If response is {error: ...}: show ToolErrorAlert

Behavior
- Selecting a tool replaces the input JSON with a minimal starter payload for that tool.
- Keep a per-tool "last payload" in local UI state so switching tools does not destroy user input unless they explicitly reset.
- Do not auto-run tools on selection.

Curve fitting workflow (special case)
- curve_fit returns model_id that is in-memory only.
- To avoid user confusion, the UI should treat curve_fit + curve_predict as a linked workflow:
  - Prefer placing curve_fit and curve_predict on the same page/section.
  - Disable curve_predict until curve_fit has succeeded in the current UI session.
  - Auto-populate curve_predict.model_id from the last successful curve_fit result.

Tool documentation (shown in Tool details panel)

Common response formats
- Plain object: tool returns JSON object directly.
- MathResult wrapper:
  - {"result": <number|array|object>, "shape": [int...], "dtype": "float64"|...}
- Errors:
  - {"error": "..."}

Tool: ping
- What it does: health check for gofr-np MCP server.
- How it works: server returns a simple status payload when reachable.
- Parameters: none
- Returns: {"status": "ok", "service": "gofr-np"}
- Example payload: {}

Tool: math_list_operations
- What it does: lists supported element-wise math operations.
- How it works: returns two lists: unary ops and binary ops.
- Parameters: none
- Returns (plain object): {"unary": [...], "binary": [...]}
- Example payload: {}

Tool: math_compute
- What it does: performs element-wise operations on scalars/arrays with broadcasting.
- How it works:
  - Takes operation name and operands a (and b for binary ops).
  - Applies broadcasting rules similar to NumPy (scalar expands to match array; compatible dimensions expand).
  - Computes in float32 or float64 precision.
- Parameters:
  - operation (string, required): operation name.
  - a (number|array, required): scalar or nested arrays.
  - b (number|array, optional): required for binary operations.
  - precision (string, optional, default float64): float32 or float64.
- Returns (MathResult): {result, shape, dtype}
- Common errors:
  - Unknown operation
  - Missing b for a binary operation
  - Shape incompatibility
- Example payloads:
  - Unary: {"operation": "abs", "a": [-1, 2, -3]}
  - Binary: {"operation": "add", "a": [1, 2, 3], "b": 10}

Tool: curve_fit
- What it does: fits a model to (x,y) data with model selection and outlier handling.
- How it works:
  - Tries candidate models depending on model_type (or multiple if auto).
  - Removes outliers using a robust strategy.
  - Chooses best model by quality metrics.
- Parameters:
  - x (number[], required)
  - y (number[], required)
  - model_type (string, optional, default auto): auto|polynomial|exponential|logarithmic|power|sigmoid
  - degree (integer, optional): only for polynomial.
- Returns (plain object):
  - model_id, model_type, equation
  - parameters: number[]
  - quality: {r_squared, rmse, aic}
  - data_points, outliers_removed
- Common errors:
  - Too few points (<3)
  - Length mismatch
  - All candidates fail
- Example payload:
  - {"x": [1,2,3,4,5], "y": [2,4,6.1,8.2,10], "model_type": "auto"}

Tool: curve_predict
- What it does: uses a fitted model_id to predict y for new x.
- How it works: loads the stored model parameters and evaluates the model on new inputs.
- Parameters:
  - model_id (string, required)
  - x (number[], required)
- Returns (MathResult): result is numeric array.
- Common errors:
  - Unknown/expired model_id
- Example payload:
  - {"model_id": "fit_...", "x": [6,7,8]}

Tool: financial_pv
- What it does: present value of cash flows with a scalar rate or a per-period yield curve.
- How it works:
  - Computes per-cashflow discount factors using discrete or continuous compounding.
  - Sums discounted flows.
- Parameters:
  - cash_flows (number[], required)
  - rate (number|number[], required): scalar or curve matching length.
  - times (number[], optional): defaults to 1..N, must match length.
  - compounding (string, optional, default discrete): discrete|continuous
- Returns (plain object):
  - present_value
  - discounted_flows
  - total_undiscounted
  - effective_rates
  - times
- Example payload:
  - {"cash_flows": [-100, 30, 40, 50], "rate": 0.05, "compounding": "discrete"}

Tool: financial_convert_rate
- What it does: converts an interest rate between compounding conventions.
- How it works: uses the effective annual rate as the bridge.
- Parameters:
  - rate (number, required)
  - from_freq (string, required): annual|semiannual|quarterly|monthly|weekly|daily|continuous|simple
  - to_freq (string, required)
- Returns (plain object): converted_rate, effective_annual_rate, from_frequency, to_frequency
- Example payload:
  - {"rate": 0.05, "from_freq": "annual", "to_freq": "monthly"}

Tool: financial_option_price
- What it does: option price and Greeks via a CRR binomial tree.
- How it works:
  - Builds a recombining binomial price tree.
  - Values payoffs at maturity and backward-inducts.
  - For American options, allows early exercise at each node.
- Parameters:
  - S, K, T, r, sigma (number, required)
  - option_type (string, required): call|put
  - exercise_style (string, required): european|american
  - steps (integer, optional, default 100)
  - q (number, optional, default 0.0): dividend yield
  - dividends (object[], optional): [{"amount": number, "time": number}, ...]
- Returns (plain object): {price, delta, gamma, theta, vega, rho, model, steps}
- Example payload:
  - {"S": 100, "K": 100, "T": 1, "r": 0.03, "sigma": 0.2, "option_type": "call", "exercise_style": "european", "steps": 100}

Tool: financial_bond_price
- What it does: bond price, duration, convexity.
- How it works:
  - Discounts coupon and principal cash flows.
  - Computes duration/convexity from discounted cashflow timing.
- Parameters:
  - face_value (number, optional, default 100)
  - coupon_rate (number, required)
  - years_to_maturity (number, required)
  - yield_to_maturity (number, required)
  - frequency (integer, optional, default 2)
- Returns (plain object): price, macaulay_duration, modified_duration, convexity, face_value, coupon_rate, yield_to_maturity
- Example payload:
  - {"coupon_rate": 0.05, "years_to_maturity": 10, "yield_to_maturity": 0.04, "frequency": 2}

Tool: financial_technical_indicators
- What it does: computes technical indicators over a price series.
- How it works:
  - Applies standard indicator formulas over the provided prices.
  - Parameters are passed through "params".
- Parameters:
  - indicator (string, required): schema advertises sma|ema|rsi|pe_ratio
  - prices (number[], conditionally required): required for SMA/EMA/RSI/etc.
  - params (object, optional, default {}): indicator-specific settings
- Notes:
  - Implementation supports additional indicators beyond schema: macd, bollinger, cross_signal.
  - UI should present the schema list, but also mention the extra supported values.
- Returns (plain object): indicator outputs and metadata (arrays + parameters used).
- Example payload:
  - {"indicator": "sma", "prices": [1,2,3,4,5,6], "params": {"window": 3}}

Data handling
- JSON input accepts numbers and nested arrays.
- Output formatting:
  - For large arrays, show only a preview (first N elements) in the main view, but keep full raw response accessible.

Hardening and limits
- Inputs can contain large arrays; the UI must guard against browser hangs.
- Add UI-side limits before sending tool calls (fail fast with a clear error):
  - Max total numeric elements across all arrays (e.g., 100k default; configurable constant).
  - Max nesting depth (e.g., 6) to prevent pathological inputs.
  - Reject NaN/Infinity values.
- Keep these limits conservative and explain the failure clearly (what exceeded, and how to recover).

Open questions (need confirmation)
All open questions resolved:
1) curve_fit model_id values are in-memory; curve_predict should be gated until curve_fit succeeds.
2) Add UI-side payload size guards to prevent browser hangs.

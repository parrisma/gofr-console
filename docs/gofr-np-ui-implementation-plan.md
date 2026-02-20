# Implementation plan: GOFR-NP UI (numpy MCP math utility)

Purpose
- Implement GOFR-NP UI module (public, no auth, single-shot math calls) with a tool runner workflow.
- Provide clear per-tool documentation and safe JSON payload entry.

Phase 0 - Baseline
- [ ] Confirm lint/build/unit tests are green before changes:
  - pnpm run lint
  - pnpm run build
  - pnpm run test:unit

Phase 1 - Types and API wrappers
- [ ] Add gofr-np types under src/types (new file recommended):
  - Ping response
  - MathResult wrapper
  - math_list_operations response
  - curve_fit response
  - financial tool response shapes (as plain objects)
- [ ] Extend src/services/api/index.ts with gofr-np calls:
  - npPing()
  - npMathListOperations()
  - npMathCompute(args)
  - npCurveFit(args)
  - npCurvePredict(args)
  - npFinancialPv(args)
  - npFinancialConvertRate(args)
  - npFinancialOptionPrice(args)
  - npFinancialBondPrice(args)
  - npFinancialTechnicalIndicators(args)

Phase 2 - GOFR-NP UI state store
- [ ] Add src/stores/gofrNpUiStore.ts:
  - selectedTool
  - perToolPayloadJson (record keyed by tool name)
  - lastCurveFitResult (store model_id and metadata)
  - lastToolResult (for display)
- [ ] Add src/hooks/useGofrNpUi.ts

Phase 3 - Routing and navigation
- [ ] Add GOFR-NP nav items and routes in src/App.tsx:
  - /gofr-np/health
  - /gofr-np/tools
- [ ] Update Dashboard GOFR-NP card:
  - route to /gofr-np/health
  - next action text adjusted from Coming soon
- [ ] Update ServiceShell help text for GOFR-NP

Phase 4 - GOFR-NP Health page
- [ ] Create src/pages/GofrNpHealthCheck.tsx
- [ ] Call npPing and show response

Phase 5 - GOFR-NP Tools page
- [ ] Create src/pages/GofrNpTools.tsx
- [ ] Implement cards:
  - Tool selector
  - Tool details panel (static docs derived from tmp/np_tools.md)
  - JSON payload editor (Validate JSON + Run)
  - Output panel (raw + structured)
- [ ] Implement curve_fit + curve_predict gating:
  - curve_predict button disabled until curve_fit succeeds
  - curve_predict payload auto-populates model_id

Phase 6 - UI hardening
- [ ] Add src/utils/npPayloadGuards.ts:
  - Parse JSON
  - Count numeric elements in nested arrays
  - Enforce max element count (default constant)
  - Enforce max depth
  - Reject NaN/Infinity
- [ ] Apply guards before every Run tool action (show clear error message)

Phase 7 - Verification
- [ ] pnpm run lint
- [ ] pnpm run build
- [ ] pnpm run test:unit
- [ ] (Optional) bash docker/build-prod.sh

Acceptance criteria
- User can select any gofr-np function and run it with JSON payload.
- Each function shows clear details: what it does, how it works, parameters, returns.
- curve_predict is blocked until curve_fit succeeds and has a model_id.
- Large inputs are rejected early with a clear explanation.

# Issue Strategy: UI hangs when MCP service unavailable

Date: 2026-02-17

## Symptom

- From Chrome, some pages/actions appear to “hang” (e.g., dashboard health check and sometimes doc actions), with console errors like:
  - `Failed to fetch` / `net::ERR_EMPTY_RESPONSE`
  - Vite showing “server connection lost”
- The UI dev server itself serves HTML/JS fine.

## Findings (validated)

- The Vite dev server is healthy and responds quickly:
  - `GET /` returns 200
  - `GET /api/config` returns 200
  - `POST /api/gofr-doc/mcp/` (initialize) returns 200 SSE with `mcp-session-id`
  - `POST /api/gofr-doc/mcp/` tools/call `list_templates` returns 200 and valid payload
- GOFR-IQ service is not running in this environment:
  - There is no `gofr-iq-mcp` container in `docker ps` output.
  - DNS resolution for `gofr-iq-mcp` times out from the dev container.
  - Any request via Vite proxy to `/api/gofr-iq/...` times out / yields empty response.

## Root cause hypothesis

1) The UI calls `api.healthCheck()` on the Dashboard mount. That calls GOFR-IQ tool `health_check`.
2) The `McpClient.initialize()` path has no timeout/abort handling.
   - If the upstream is unavailable (DNS hang / connection stall), `initialize()` can wait indefinitely.
   - Because `callTool()` awaits `initialize()` before it starts its own 40s timeout, the request can “hang” much longer than expected.
3) The Dashboard code does not `catch` errors from `api.healthCheck()`, so failures can become unhandled rejections and degrade the UI experience.

## Goals

- UI must fail fast and show a useful error when an MCP service is down/unreachable.
- UI must remain usable for other services (e.g., GOFR-DOC pages) even if GOFR-IQ is down.
- Avoid adding new UX or pages; keep changes minimal and consistent with existing patterns.

## Proposed fix (minimal)

A) Add timeout + AbortController to MCP `initialize()` (and optionally `notify()`) similar to `callTool()`.

- This ensures a dead service fails in a bounded time (e.g., 5–10 seconds).
- Error should become an `ApiError` with recovery guidance.

B) Make `api.healthCheck()` resilient:

- Wrap call in try/catch and return a default “unknown/down” object on failure.

C) Update Dashboard to handle failures:

- Add `.catch(...)` in the effect to prevent unhandled promise rejections.

## Assumptions to confirm

- If GOFR-IQ is not running, Dashboard should not block; it should display unknown/down status.
- A short timeout (5–10s) for initialize is acceptable for your environment.

## Validation plan

- With GOFR-IQ still absent:
  - Dashboard loads without hanging; health cards show unknown/down and UI remains navigable.
  - GOFR-DOC `list_templates` and `ping` still succeed.
- With GOFR-IQ present later:
  - Health check returns real data and dashboard behaves as before.

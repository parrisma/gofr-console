# Implementation Plan: UI hangs when MCP service unavailable

Date: 2026-02-17

## Step 1 — Add bounded timeouts for MCP initialize

- Update `McpClient.doInitialize()` in `src/services/api/index.ts`:
  - Use `AbortController`.
  - Add a timeout (configurable constant) to abort initialize if upstream is unresponsive.
  - Convert failures into the existing `ApiError` shape with a clear recovery hint.
- (Optional but recommended) Apply the same timeout behavior to `notify()`.

Check:

- Force GOFR-IQ absent (current state) and verify `initialize()` fails within the configured time.

## Step 2 — Make health check calls resilient

- Update `api.healthCheck()` to catch exceptions and return a default response reflecting service down/unknown.

Check:

- Visiting `/` does not hang even when GOFR-IQ is absent.

## Step 3 — Prevent unhandled promise rejections in Dashboard

- Update `src/pages/Dashboard.tsx` to handle rejected `api.healthCheck()` promises.

Check:

- Chrome console no longer shows unhandled promise errors from Dashboard.

## Step 4 — Targeted tests

- If there are existing unit tests around the API client, add/extend a small test for initialize timeout behavior.
- Otherwise, do a targeted manual verification using curl and the UI.

## Step 5 — Run test suite

- Run `scripts/run_tests.sh` (targeted first, then full as needed per repo guidance).

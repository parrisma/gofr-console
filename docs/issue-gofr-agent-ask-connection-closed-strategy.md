# GOFR-Agent Ask Connection Closed Strategy

## Symptom

The GOFR-Agent chat UI can fail an `ask` call with MCP error `-32000: Connection closed` even when the UI ask timeout is configured above the server timeout.

## Hypothesised Root Cause

`-32000` is the MCP SDK `ConnectionClosed` code. The SDK raises it when the transport closes and rejects in-flight requests. It is not the SDK per-request timeout path (`-32001: Request timed out`).

Likely UI-side contributors are lifecycle actions that close the shared GOFR-Agent client while an ask is active, especially token changes, route unmounts, page reload/HMR, or refresh/error paths that close the client.

## Assumptions and Validation

- The per-call ask timeout is being passed to `client.callTool(..., options)`.
- The configured timeout only controls client wait duration; it cannot keep a closed transport alive.
- The SDK source shows `Connection closed` is emitted from the protocol close handler, while request timeout is emitted separately with code `-32001`.

## Diagnostics Order

1. Distinguish `-32000` connection closure from `-32001` client request timeout in UI error mapping and logs.
2. Prevent avoidable UI client closes during active asks, starting with token switching.
3. If the error persists without UI interaction or reload, inspect GOFR-Agent, Vite proxy, and container/network logs for server-side or proxy-side stream closure before the configured timeout.
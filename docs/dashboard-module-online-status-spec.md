# Spec: Dashboard module online status (ping-gated)

## Goal

On the Dashboard, each module card should only display "Online" after the console has successfully received a ping response from that module's backend.

## Current behavior

- Dashboard cards show "Online" unconditionally (even if a backend is down).
- Only GOFR-IQ uses a separate health check call, but the module cards themselves do not reflect real-time reachability.

## Proposed behavior

- For each module (GOFR-IQ, GOFR-DIG, GOFR-DOC, GOFR-PLOT, GOFR-NP):
  - Initial state: "Checking" (or equivalent non-Online state).
  - If ping succeeds: show "Online".
  - If ping fails (network error, non-OK response, timeout, tool error): show "Offline".

## Definition of "ping"

- Use the MCP tool named "ping" for each module's service.
- A module is considered reachable if the ping tool call completes successfully (no exception thrown by the API layer).

## UX constraints

- Keep the existing Dashboard layout and card structure.
- Only change the status display logic and its icon/text.
- No new pages.

## Edge cases

- If a module has no configured route ("Coming soon"), still compute and show Online/Offline based on ping.
- If a module does not expose ping without auth, it will appear Offline.

## Non-goals

- Do not add continuous polling; one-time check on Dashboard load is sufficient.
- Do not add new backend endpoints.
- Do not change Operations token management.

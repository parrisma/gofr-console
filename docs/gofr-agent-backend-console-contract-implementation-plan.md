# Implementation Plan: GOFR-Agent Backend Console Contract

Status: draft, awaiting review
Spec: `docs/gofr-agent-backend-console-contract-spec.md`
Contract source: `tmp/gofr-agent.md`, Section 2
Primary owner: GOFR-Agent backend/deployment
Console follow-up owner: GOFR Console UI

## Peer Review Notes

- The durable fix is backend/deployment configuration, not another bearer-token
  or React header variation.
- `/ping` and `/health` are documented as existing GOFR-Agent HTTP routes in
  `tmp/gofr-agent.md`, Section 2. The plan validates their deployment rather
  than treating them as new feature work.
- HTTP `/health` is compact and unauthenticated. Detailed model, limits,
  feature, hub, and downstream service diagnostics belong in authenticated MCP
  `health_check`.
- HTTP `/health` should return `200` for `healthy` and `degraded`, and `503`
  only for `unhealthy`.
- MCP initialize alone does not prove bearer-token authorization. A tokened
  `tools/call` must be executed to verify auth behavior.

## Execution Notes - 2026-05-17

Executed the safe validation subset from `gofr-console-dev` against the current
local `gofr-agent-dev` container.

Observed container state:

- `gofr-agent-dev` is running image `gofr-agent-dev:latest` with command
  `tail -f /dev/null`.
- Port `8090` is currently served inside the dev container by
  `uv run python scripts/fixture_chat.py --max-steps 50 --agent-timeout-seconds 240`.
- Relevant `GOFR_AGENT_MCP_ALLOWED_*` and `GOFR_AGENT_CORS_ORIGINS` environment
  variables were not present in the container environment.

Validation results:

- Direct `GET http://gofr-agent-dev:8090/ping` returned `404 Not Found`.
- Direct `GET http://gofr-agent-dev:8090/health` returned `404 Not Found`.
- Direct MCP initialize with `Host: gofr-agent-dev:8090` and
  `Origin: http://localhost:3000` returned `403 Invalid Origin header`.
- MCP initialize through the console proxy returned `200 OK` because the current
  Vite workaround strips `Origin` before forwarding to GOFR-Agent.
- Valid `dev-admin-token` plus MCP `tools/call ping` returned `status: ok`.
- Invalid token plus MCP `tools/call ping` failed closed with
  `Not authorized for activity: GoFRAgentPing`.
- Valid `dev-admin-token` plus MCP `health_check` returned `healthy` with four
  healthy downstream fixture services.
- Valid `dev-admin-token` plus MCP `list_services` returned the fixture service
  capability list.

Execution conclusion:

- The console workaround keeps local MCP chat unblocked.
- The current backend runtime is not aligned with the Section 2 deployment
  contract because HTTP `/ping` and `/health` are not reachable and browser
  Origin forwarding is still rejected.
- Do not remove the console Vite `Origin` stripping workaround until a backend
  runtime with the Section 2 allow-lists and HTTP health routes is deployed.

## Execution Notes - 2026-05-17 (later update)

Retested from `gofr-console-dev` after the backend runtime was brought up at
the documented location.

Observed results:

- Direct `GET http://gofr-agent-dev:8090/ping` returned `200 OK` with the
  documented compact JSON payload.
- Direct `GET http://gofr-agent-dev:8090/health` returned `200 OK` with the
  documented compact JSON payload and downstream counts.
- Direct MCP initialize with `Origin: http://localhost:3000` returned `200 OK`
  and `Access-Control-Allow-Origin: http://localhost:3000`.
- The console-side Vite `Origin` stripping workaround in `vite.config.ts` was
  removed.
- After restarting the console UI, proxied `GET /api/gofr-agent/ping` returned
  `200 OK`.
- After restarting the console UI, proxied `GET /api/gofr-agent/health`
  returned `200 OK`.
- After restarting the console UI, proxied browser-origin MCP initialize
  through `/api/gofr-agent/mcp` returned `200 OK` with `Mcp-Session-Id`.
- No fresh GOFR-Agent `Invalid Origin header` or `Invalid Host header`
  warnings were observed during these checks.

Updated execution conclusion:

- The backend runtime is now aligned with the Section 2 console transport and
  health-route contract.
- The console no longer needs the temporary Vite `Origin` stripping workaround.
- UI-side cleanup for this issue is complete.

## Purpose

Align GOFR-Agent backend deployment with the documented React integration
contract so GOFR Console can call GOFR-Agent through `/api/gofr-agent/mcp`
without stripping or rewriting browser request headers.

This plan treats `/ping` and `/health` as existing GOFR-Agent HTTP routes, not
new feature work. The work is to verify they are reachable, keep them
unauthenticated, configure FastMCP Host/Origin protection correctly, and remove
the temporary console-side Vite `Origin` stripping after the backend fix is
deployed.

## Known Local Topology

- Host browser URL: `http://localhost:3000/gofr-agent`
- Console container: `gofr-console-dev`
- Console dev server: port `3000`, published to host port `3000`
- Browser-facing MCP proxy path: `/api/gofr-agent/mcp`
- GOFR-Agent container/service: `gofr-agent-dev`
- GOFR-Agent MCP/HTTP port: `8090`
- GOFR-Agent MCP endpoint: `http://gofr-agent-dev:8090/mcp`
- GOFR-Agent health endpoints:
  - `http://gofr-agent-dev:8090/ping`
  - `http://gofr-agent-dev:8090/health`

## Required Backend Configuration

Configure GOFR-Agent with the Section 2 local console values:

```text
GOFR_AGENT_MCP_ALLOWED_HOSTS=gofr-agent-dev,gofr-agent-dev:8090,gofr-agent:8090,127.0.0.1:*,localhost:*,[::1]:*
GOFR_AGENT_MCP_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://gofr-console-dev:3000
GOFR_AGENT_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://gofr-console-dev:3000
```

Do not change `GOFR_AGENT_ALLOWED_SERVICE_HOSTS` for this issue. That setting
controls outbound runtime service registration and does not fix inbound MCP
Host or Origin rejection.

Keep `GOFR_AGENT_MCP_DNS_REBINDING_PROTECTION_ENABLED` enabled unless the
backend owner explicitly decides otherwise. The fix should be an explicit
allow-list, not disabling transport protection.

## Phase 0 - Baseline Verification

Goal: prove the current failure mode and capture the exact request shape before
changing backend config.

- [ ] Confirm the GOFR-Agent container and port from the console container.
- [ ] Confirm `GET /ping` responds without a bearer token.
- [ ] Confirm `GET /health` responds without a bearer token.
- [ ] Check whether the console proxy is still stripping `Origin`. If it is,
      note that proxy-based MCP initialize validates MCP/token flow but does not
      validate the backend Origin allow-list.
- [ ] Run MCP initialize through the console proxy with browser-shaped headers.
- [ ] Record whether the backend emits:
  - [ ] `Invalid Host header`
  - [ ] `Invalid Origin header`
- [ ] Verify invalid or missing bearer tokens still fail closed for MCP tool
      calls.

Commands from `gofr-console-dev`:

```bash
curl -sS -i --max-time 5 http://gofr-agent-dev:8090/ping
curl -sS -i --max-time 5 http://gofr-agent-dev:8090/health
curl -sS -i --max-time 10 \
  -H 'Host: localhost:3000' \
  -H 'Origin: http://localhost:3000' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer dev-admin-token' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"gofr-console-smoke","version":"0.0.1"}}}' \
  http://gofr-console-dev:3000/api/gofr-agent/mcp
docker logs --since 2m gofr-agent-dev 2>&1 | grep -E 'Invalid (Origin|Host) header' || true
```

Acceptance:

- Current behavior is documented before changing config.
- `/ping` and `/health` behavior is known separately from MCP auth behavior.
- The failure is confirmed as transport security if `421` or `403 Invalid
  Origin header` appears.

## Phase 1 - Configure GOFR-Agent Transport Security

Goal: update backend deployment config so valid console-origin MCP traffic is
accepted without weakening transport security globally.

- [ ] Locate the active GOFR-Agent dev deployment config.
- [ ] Add or update `GOFR_AGENT_MCP_ALLOWED_HOSTS` with the Section 2 values.
- [ ] Add or update `GOFR_AGENT_MCP_ALLOWED_ORIGINS` with the Section 2 values.
- [ ] Add or update `GOFR_AGENT_CORS_ORIGINS` with the Section 2 values.
- [ ] Keep wildcard origins out of CORS because MCP uses bearer auth.
- [ ] Keep `GOFR_AGENT_MCP_DNS_REBINDING_PROTECTION_ENABLED` enabled unless a
      separate reviewed security decision changes it.
- [ ] Restart only the GOFR-Agent service needed to load the new config.
- [ ] Confirm the running process sees the intended values without printing
      tokens or unrelated secrets.

Acceptance:

- GOFR-Agent starts cleanly with the new allow-lists.
- The backend no longer rejects `http://localhost:3000` as an invalid origin.
- The backend no longer rejects the proxy target host used for MCP traffic.

## Phase 2 - Verify Existing HTTP Health Routes

Goal: validate the health routes documented in Section 2 and keep them compact,
safe, and unauthenticated.

- [ ] Verify `GET /ping` returns `200` without `Authorization`.
- [ ] Verify `/ping` response includes:
  - [ ] `status: "ok"`
  - [ ] `service: "gofr-agent"`
  - [ ] `version`
  - [ ] `timestamp`
- [ ] Verify `GET /health` returns without `Authorization`.
- [ ] Verify `/health` returns HTTP `200` when status is `healthy` or
  `degraded`.
- [ ] Verify `/health` returns HTTP `503` only when status is `unhealthy`.
- [ ] Verify `/health` response includes:
  - [ ] `status: "healthy" | "degraded" | "unhealthy"`
  - [ ] `service: "gofr-agent"`
  - [ ] `timestamp`
  - [ ] `version`
  - [ ] `message`
  - [ ] compact downstream counts under `downstream`
- [ ] Verify `/health` uses bounded downstream checks and does not hang.
- [ ] Verify `/health` does not return selected model, allowed model overrides,
      service URLs, tool names, tokens, API keys, raw prompt content, raw tool
      payloads, or raw provider errors.

Acceptance:

- `/ping` distinguishes process reachability from token validity.
- `/health` distinguishes compact readiness from authenticated MCP diagnostics.
- Downstream degraded state is represented as `status: "degraded"` and does
  not block the console chat surface by itself.

## Phase 3 - Verify Tokened MCP Diagnostics

Goal: prove the configured bearer token can access MCP tools after transport
security is fixed.

- [ ] Run MCP initialize through `/api/gofr-agent/mcp` with
      `Authorization: Bearer dev-admin-token`.
- [ ] Confirm the response is SSE and includes `Mcp-Session-Id`.
- [ ] Call MCP `ping` with the initialized SDK/session.
- [ ] Call MCP `health_check` and verify it returns detailed diagnostics.
- [ ] Call MCP `list_services` and verify model-visible tools are returned.
- [ ] Confirm hidden hub tools and admin-only tools are not presented as normal
      user-invokable actions in the console UI.
- [ ] Repeat one MCP call with an invalid token and confirm it fails closed.

Acceptance:

- Valid dev token can initialize MCP and call public tools.
- Invalid token is rejected.
- MCP `health_check` remains the source for detailed model, limits, features,
  hub, and downstream service diagnostics.

## Phase 4 - Remove Console Proxy Workaround

Goal: remove the temporary UI-side workaround after the backend accepts the
documented Host and Origin values.

- [ ] In GOFR Console, remove the `/api/gofr-agent` Vite proxy code that strips
      the `Origin` header.
- [ ] Keep `changeOrigin: true` unless Vite proxy behavior is separately
      redesigned for all services.
- [ ] Restart the console dev server so `vite.config.ts` reloads.
- [ ] Re-run the browser-shaped MCP initialize command with
      `Origin: http://localhost:3000`.
- [ ] Verify GOFR-Agent logs contain no fresh `Invalid Origin header` or
      `Invalid Host header` warnings.

Acceptance:

- Console can call GOFR-Agent through `/api/gofr-agent/mcp` without rewriting or
  removing `Origin`.
- The temporary workaround is gone from `vite.config.ts`.
- Chat page and health page continue to load:
  - [ ] `/gofr-agent`
  - [ ] `/gofr-agent/health`

## Phase 5 - End-to-End Console Validation

Goal: confirm the user-facing agentic AI workflow works after backend and
console cleanup.

- [ ] Open `http://localhost:3000/gofr-agent/health`.
- [ ] Select or override token with `dev-admin-token` in local dev.
- [ ] Confirm HTTP ping, HTTP health, MCP ping, MCP `health_check`, and
      `list_services` all load.
- [ ] Open `http://localhost:3000/gofr-agent`.
- [ ] Ask: `What tools are available?`
- [ ] Confirm an assistant response appears.
- [ ] Confirm run trace events or completed steps are visible.
- [ ] Confirm provenance and turn metadata render without secrets.
- [ ] Reset the session and confirm the transcript clears.

Acceptance:

- GOFR-Agent is usable as an agentic AI workbench from the console.
- Health and capabilities are available on the dedicated health page.
- Main chat page remains focused on asking, tracing, inspecting, and continuing
  the session.

## Rollback

If the backend config change causes unrelated service access issues:

- [ ] Revert only the GOFR-Agent allow-list config changes.
- [ ] Restart GOFR-Agent.
- [ ] Restore the temporary console proxy Origin stripping only if needed to
      keep local development unblocked.
- [ ] Capture the rejected Host and Origin values from GOFR-Agent logs before
      making another config attempt.

## Done Criteria

- Backend allow-lists match Section 2 local console values or a reviewed
  environment-specific equivalent.
- `/ping` and `/health` remain unauthenticated and reachable on the GOFR-Agent
  HTTP port.
- Browser-shaped MCP initialize succeeds through the console proxy with normal
  `Origin` forwarding.
- No valid console-origin request produces `Invalid Host header` or
  `Invalid Origin header` warnings.
- The temporary Vite Origin-stripping workaround is removed.
- GOFR Console chat and health pages both work with `dev-admin-token` in local
  development.
# Spec: GOFR-Agent Backend Console Contract

Status: draft, awaiting review
Owner: GOFR-Agent backend/deployment
Consumers: GOFR Console UI, dashboard health checks, local dev workflow
Contract source: `tmp/gofr-agent.md`, Section 2

## Purpose

Make GOFR-Agent usable from GOFR Console without UI-side transport-security
workarounds. The console should be able to load the agent workbench, check
process readiness, inspect agent runtime health, initialize MCP, and run chat
requests through the Vite proxy using the same browser-origin request shape a
developer uses locally.

The current console workaround strips the `Origin` header for `/api/gofr-agent`
inside `vite.config.ts`. That workaround proves the UI and MCP client path are
valid, but it should be removed once GOFR-Agent accepts the intended console
origins and proxy hostnames.

## Background

GOFR Console runs in the `gofr-console-dev` container and is published to the
host on port `3000`. A host browser opens:

```text
http://localhost:3000/gofr-agent
```

The browser calls the console same-origin proxy:

```text
/api/gofr-agent/mcp
```

Vite forwards that request over `gofr-net` to:

```text
http://gofr-agent-dev:8090/mcp
```

During integration, GOFR-Agent rejected valid local console traffic with
transport-security warnings such as:

```text
Invalid Origin header: http://localhost:3000
Invalid Origin header: http://gofr-agent-dev:8090
```

The goal is not to loosen security broadly. The goal is to explicitly allow the
known console origins and proxy hostnames that are part of the local and
deployed GOFR topology.

## Goals

- Configure GOFR-Agent transport security so the console can call MCP through
  the same-origin proxy without stripping or rewriting browser headers.
- Preserve the existing unauthenticated `GET /ping` and `GET /health` routes on
  the GOFR-Agent HTTP service.
- Keep MCP chat and tool execution bearer-authenticated.
- Keep responses free of tokens, prompts, pasted content, and other sensitive
  user data.
- Use Docker service names on `gofr-net`; do not depend on `localhost` between
  containers.

## Non-goals

- Do not allow arbitrary origins or hosts.
- Do not make the browser call `http://gofr-agent-dev:8090/mcp` directly.
- Do not require a console-specific development token in production.
- Do not expose admin-only or internal GOFR-Agent tools through unauthenticated
  health routes.

## Transport Security Contract

GOFR-Agent must accept requests from the console proxy path without requiring
the console to remove `Origin`.

The backend reads the relevant transport settings from:

```text
GOFR_AGENT_MCP_ALLOWED_HOSTS
GOFR_AGENT_MCP_ALLOWED_ORIGINS
GOFR_AGENT_MCP_DNS_REBINDING_PROTECTION_ENABLED
GOFR_AGENT_CORS_ORIGINS
```

Do not use `GOFR_AGENT_ALLOWED_SERVICE_HOSTS` for this issue. That setting
controls outbound runtime service registration, not inbound MCP Host or Origin
protection.

### Allowed hosts

For the local console topology, configure:

```text
GOFR_AGENT_MCP_ALLOWED_HOSTS=gofr-agent-dev,gofr-agent-dev:8090,gofr-agent:8090,127.0.0.1:*,localhost:*,[::1]:*
```

Production and shared development deployments must include their actual public,
proxy, and Docker Host values explicitly. If production uses a distinct MCP
service name, include that service name and port as well, for example:

```text
gofr-agent-mcp
gofr-agent-mcp:8090
```

### Allowed origins

For the local console topology, configure:

```text
GOFR_AGENT_MCP_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://gofr-console-dev:3000
GOFR_AGENT_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://gofr-console-dev:3000
```

Production and shared development environments must add their actual console
origin values explicitly. Wildcard origins are not acceptable when
`Authorization` is allowed.

### Required CORS behavior

For browser-origin requests that reach GOFR-Agent directly or through a proxy,
GOFR-Agent must allow:

```text
Authorization
Content-Type
Accept
Mcp-Session-Id
```

The MCP response must continue to expose the session header needed by the SDK:

```text
Mcp-Session-Id
```

The console normally calls GOFR-Agent through a same-origin proxy, but backend
configuration should still be correct when the proxy forwards browser Origin
headers.

## Stable HTTP Routes

GOFR-Agent exposes `GET /ping` and `GET /health` on the same HTTP server that
serves `/mcp`. These routes must remain compact, safe, and unauthenticated.

### GET /ping

Purpose: cheap process liveness check.

Authentication: none.

Dependencies: none. This route should not call downstream MCP services or model
providers.

Success response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store
```

```json
{
  "status": "ok",
  "service": "gofr-agent",
  "timestamp": "2026-05-17T15:00:00Z",
  "version": "1.27.1"
}
```

`status`, `service`, `timestamp`, and `version` are required.

### GET /health

Purpose: runtime readiness and dependency status for console diagnostics.

Authentication: none.

Status codes:

- `200 OK` when GOFR-Agent reports `healthy` or `degraded`.
- `503 Service Unavailable` when GOFR-Agent reports `unhealthy`.

Required response shape:

```json
{
  "status": "healthy",
  "service": "gofr-agent",
  "timestamp": "2026-05-17T15:00:00Z",
  "version": "1.27.1",
  "message": "GOFR-Agent readiness is healthy.",
  "downstream": {
    "total": 3,
    "healthy": 3,
    "degraded": 0,
    "failed": 0
  }
}
```

Allowed `status` values:

```text
healthy
degraded
unhealthy
```

HTTP `/health` intentionally omits selected model, allowed model overrides,
service URLs, tool names, tokens, API keys, raw prompt content, and raw provider
errors. Detailed runtime diagnostics belong in authenticated MCP
`health_check`.

The `/health` implementation must use short bounded timeouts for downstream
checks so the console does not hang while rendering the dashboard or agent page.

## MCP Contract

The existing MCP endpoint remains:

```text
POST /mcp
```

Required request headers:

```text
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <token>
Mcp-Session-Id: <session-id>  after initialize
```

Initialization must return an MCP session id header:

```text
Mcp-Session-Id: <session-id>
```

Development tokens such as `dev-admin-token` and `dev-read-token` may be
available only in local development images or explicit development mode. They
must not be accepted in production unless production has intentionally configured
them, which should be treated as a security exception.

## Console Cleanup After Backend Fix

After GOFR-Agent implements this contract, GOFR Console should remove the
temporary `/api/gofr-agent` proxy `Origin` stripping in `vite.config.ts` and
verify that normal browser-origin requests still pass.

The console may keep its fallback behavior for older or misconfigured
GOFR-Agent deployments where `/ping` or `/health` are not reachable, but current
GOFR-Agent deployments expose both routes.

## Acceptance Criteria

- From a host browser, `http://localhost:3000/gofr-agent` loads and initializes
  MCP through `/api/gofr-agent/mcp` without Vite stripping or rewriting
  `Origin`.
- GOFR-Agent logs contain no `Invalid Origin header` or `Invalid Host header`
  warnings for console-origin traffic.
- `GET /ping` returns `200` with `status: "ok"`, `service: "gofr-agent"`,
  `timestamp`, and `version`.
- `GET /health` returns `200` for `healthy` or `degraded` and `503` for
  `unhealthy`, with a bounded compact JSON response matching the documented
  shape.
- MCP initialize through the console proxy returns `200`, an SSE `message`
  event, and an `Mcp-Session-Id` response header.
- A chat request with a valid development token succeeds in local development.
- Invalid or missing bearer tokens still fail closed for MCP tool execution.
- No response or log path exposes bearer tokens, prompts, pasted content, or raw
  sensitive downstream payloads.

## Validation Commands

Run these from the `gofr-console-dev` container after removing the temporary
console proxy Origin stripping:

```bash
curl -sS -i --max-time 5 http://gofr-agent-dev:8090/ping
curl -sS -i --max-time 5 http://gofr-agent-dev:8090/health
```

Browser-shaped MCP initialize through the console proxy:

```bash
curl -sS -i --max-time 10 \
  -H 'Host: localhost:3000' \
  -H 'Origin: http://localhost:3000' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer dev-admin-token' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"gofr-console-smoke","version":"0.0.1"}}}' \
  http://gofr-console-dev:3000/api/gofr-agent/mcp
```

Expected result: `HTTP/1.1 200 OK`, `content-type: text/event-stream`, an
`mcp-session-id` response header, and `serverInfo.name` equal to `gofr-agent`.

Log check:

```bash
docker logs --since 2m gofr-agent-dev 2>&1 | grep -E 'Invalid (Origin|Host) header' || true
```

Expected result: no matching lines for valid console-origin traffic.
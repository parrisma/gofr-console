# GOFR-Agent Console Integration Proposal

## Purpose

Add GOFR-Agent to GOFR Console as a first-class operations module where users
can ask natural-language questions against the platform reasoning agent, watch
tool-backed progress, inspect capabilities and provenance, and continue the
same server-side session across follow-up turns.

The first release should build the actual chat workbench as the first screen.
It should not be a landing page or an explanatory splash screen.

## Source Context

This proposal is based on [../tmp/gofr-agent.md](../tmp/gofr-agent.md), the
current GOFR Console MCP patterns, and the current config-driven Vite proxy
setup.

Current GOFR-Agent backend facts that the console UI must preserve:

| Item | Current value or behavior |
|------|---------------------------|
| Transport | MCP Streamable HTTP |
| Endpoint path | `/mcp` |
| Default Docker/dev URL | `http://gofr-agent:8090/mcp` |
| MCP port | `8090` |
| mcpo proxy port | `8091`, not the preferred React path |
| Reserved future web UI port | `8092` |
| Auth | Bearer token in `Authorization` on every MCP request |
| Dev admin token | `dev-admin-token`, local development only |
| Session model | Server-side history keyed by caller-provided `session_id` |
| Session TTL default | 60 idle minutes |
| Default max steps | 10 |
| Hard max steps | 50 |
| Agent timeout default | 120 seconds |
| Final response | Returned by the MCP `ask` tool after the run finishes |
| Live progress | MCP `notifications/message` with logger `gofr-agent.reasoning` |

Current GOFR Console facts:

- Vite proxy entries are generated from
  [../data/config/ui-config.json](../data/config/ui-config.json).
- The existing generic MCP client in
  [../src/services/api/index.ts](../src/services/api/index.ts) hand-rolls
  JSON-RPC/SSE and currently initializes without bearer auth.
- Existing MCP wrappers parse text content that contains JSON.
- Tokens are stored outside UI config through `tokenStore` and selected with
  `TokenSelect`.
- GOFR modules are routed in [../src/App.tsx](../src/App.tsx), surfaced in
  [../src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx), and wrapped by
  `ServiceShell` when they have service-specific navigation.

## Product Shape

Add a GOFR-Agent module at `/gofr-agent` with a compact chat workbench for
repeated operational use.

The page should include:

- Chat transcript with user turns, assistant answers, verification gaps, and
  clarification prompts.
- Composer with send, reset, output format, `max_steps`, `tools_only`, and
  `no_commentary` controls.
- Token selector using the existing console token flow.
- Connection status from `ping` with connected, unauthorized, unavailable, and
  misconfigured states.
- Capabilities panel populated by `list_services`.
- Live run trace populated from GOFR-Agent reasoning notifications.
- Per-turn metadata for `request_id`, model, token count, duration, and source
  summary.
- Provenance/details panel for tool attempts, freshness, artifacts, and raw
  debug JSON behind disclosures.

The interface should be dense, calm, and readable. It should make the primary
workflow immediate: ask a question, watch progress, inspect sources/tools, and
continue the same session.

## Backend Contract

The public GOFR-Agent tools relevant to the UI are:

| Tool | UI use |
|------|--------|
| `ping` | Startup health and settings validation |
| `list_services` | Capabilities and degraded-service visibility |
| `ask` | Main chat request |
| `reset_session` | Clear current server-side conversation history |

Admin tools `register_service` and `refresh_services` should not appear in the
normal chat surface. Hidden hub tools `_store_result`, `_get_result`, and
`_describe_result` must not be called by the browser UI. Reserved downstream
tool `_register_results_hub` should not be shown as a user-invokable action.

The `ask` request should model the full current payload, not only the minimal
question/session fields:

```ts
type AgentAskRequest = {
  question: string;
  session_id?: string;
  context?: string;
  instructions?: string;
  asserted_facts?: string[];
  pasted_content?: string[];
  forbidden_services?: string[];
  forbidden_tools?: string[];
  allowed_services?: string[];
  tools_only?: boolean;
  output_format?: "json" | "text";
  no_commentary?: boolean;
  max_steps?: number;
  model_override?: string;
};
```

The response should include the current hardening fields:

- `session_id`
- `request_id`
- `answer`
- `steps`
- `model`
- `tokens_used`
- `verification_gap`
- `clarification_request`
- `provenance`

`verification_gap` and `clarification_request` are successful run outcomes, not
transport failures. They should produce visible assistant turns with a distinct
status.

## MCP Client Strategy

Use the official MCP TypeScript SDK for GOFR-Agent integration. The agent guide
explicitly says not to hand-roll MCP JSON-RPC for this UI.

This console already has a generic hand-written `McpClient`. That client can
remain in place for existing modules, but GOFR-Agent should use an SDK-backed
client module so the first implementation supports protocol behavior that
matters for the agent, especially logging notifications.

Recommended shape:

- Add `@modelcontextprotocol/sdk` with `pnpm add @modelcontextprotocol/sdk`.
- Add `src/services/gofrAgent/client.ts` for SDK transport creation,
  notification registration, and text-JSON parsing.
- Add `src/services/gofrAgent/api.ts` or expose equivalent typed methods from
  the existing `api` service facade.
- Keep UI code behind typed wrappers such as `agentPing`, `agentListServices`,
  `agentAsk`, and `agentResetSession`.
- Keep the SDK MCP transport session separate from the GOFR-Agent application
  `session_id` used in `ask` and `reset_session` payloads.

The SDK transport should call the proxy URL `/api/gofr-agent/mcp` in the
browser and send `Authorization: Bearer <token>` on every MCP request. Browser
code must not call `http://gofr-agent:8090/mcp` directly.

If the team chooses to reuse or migrate the existing generic `McpClient`
instead, that work must first add bearer auth to `initialize` and
`notifications/initialized`, robust notification handling, and an agent-specific
timeout. Without those changes it is not sufficient for GOFR-Agent.

## Configuration

Add GOFR-Agent to `mcpServices` in
[../data/config/ui-config.json](../data/config/ui-config.json):

```json
{
  "name": "gofr-agent",
  "displayName": "GOFR-Agent",
  "containerHostname": "gofr-agent",
  "ports": {
    "prod": { "mcp": 8090, "mcpo": 8091, "web": 8092 },
    "dev": { "mcp": 8090, "mcpo": 8091, "web": 8092 }
  }
}
```

This makes Vite generate `/api/gofr-agent` proxy routes. The chat UI should use
`/api/gofr-agent/mcp`. If deployment separates prod and dev ports later, update
the config rather than hard-coding service URLs in React code.

Production token guidance:

- Do not hard-code `dev-admin-token` in source, UI config, docs rendered inside
  the app, or logs.
- Prefer normal user-managed tokens from `tokenStore` unless the platform
  defines a separate short-lived agent token flow.
- Treat auth failures as recoverable configuration errors.
- If the console is served outside the same origin proxy, GOFR-Agent deployment
  must explicitly allow the browser origin and `Authorization` header via CORS.

## State Model

Add explicit types in `src/types/gofrAgent.ts` for:

- `AgentPingResponse`
- `AgentServiceStatus`
- `AgentAskRequest`
- `AgentAskResponse`
- `AgentReasoningEvent`
- `AgentVerificationGap`
- `AgentClarificationRequest`
- `AgentProvenanceRecord`
- `AgentConnectionState`
- `AgentTurn`
- `AgentChatState`

The reducer should keep local display state separate from server-side model
history. The browser owns visible turns and UI state; GOFR-Agent owns history by
`session_id`.

Reducer rules:

- Generate a local `session_id` with `crypto.randomUUID()` and reuse the
  returned `session_id` after each `ask` response.
- Append the user turn immediately.
- Create a pending assistant turn before calling `ask`.
- Register `notifications/message` immediately after the SDK client connects.
- Accept only notifications where `params.logger` is `gofr-agent.reasoning`.
- Sort reasoning events by `sequence`, not arrival time.
- Use `event_id` for stable React keys.
- Before final `request_id` is known, attach notifications to the pending
  assistant turn.
- Once the final response arrives, bind the assistant turn to `request_id` and
  reconcile final `steps` with any live events already shown.
- Mark `run_failed` as a failed active turn while still letting the `ask`
  promise settle.
- Show `text_delta` only as an optional live draft; the final answer comes from
  `ask`.

## UI Components

Recommended files:

- `src/pages/GofrAgent.tsx`
- `src/hooks/useGofrAgentChat.ts`
- `src/components/agent/AgentChatThread.tsx`
- `src/components/agent/AgentComposer.tsx`
- `src/components/agent/AgentCapabilitiesPanel.tsx`
- `src/components/agent/AgentRunTrace.tsx`
- `src/components/agent/AgentTurnMetadata.tsx`
- `src/components/agent/AgentProvenancePanel.tsx`

Use MUI and the existing service-page conventions. Controls should be familiar:
icon buttons for send/reset/refresh/settings, a numeric input or stepper for
`max_steps`, segmented buttons for output format, toggles for `tools_only` and
`no_commentary`, and collapsible details for tools, trace, provenance, and raw
debug JSON.

Do not render model output with unsafe HTML. Render as text by default, or use a
sanitized markdown renderer only after a vetted renderer is introduced.

## Routing and Navigation

Add GOFR-Agent routes in [../src/App.tsx](../src/App.tsx):

- `/gofr-agent` for chat
- Optional `/gofr-agent/capabilities` only if the capabilities panel outgrows
  the chat workbench

Use `ServiceShell` with GOFR-Agent-specific navigation. Initial navigation can
be:

- Chat
- Capabilities

Add a GOFR-Agent card to [../src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx)
and include it in module status checks. Because `ping` requires auth, dashboard
status should distinguish at least these states:

- Online when a selected or preferred token succeeds.
- Needs token when no usable token is available.
- Unauthorized when a token exists but is rejected.
- Offline when transport fails.

If dashboard token selection is not available, the card can show configured but
needs token and route users to the GOFR-Agent page.

## Human-in-the-Loop Behavior

Do not implement true mid-run browser input yet.

The backend currently includes internal models and event kinds for future human
input, but the public MCP API does not expose tools such as
`respond_to_user_input`, `get_pending_user_input`, or `cancel_user_input`.

Current UI behavior should be:

- Render `clarification_request.prompt` as an assistant ask-back after `ask`
  completes.
- Let the user answer by sending a normal follow-up `ask` in the same
  `session_id`.
- Type future human-input events defensively in the reducer.
- Do not show pause/resume controls that imply the original run is waiting for
  browser input.

## Results Hub and Descriptors

GOFR-Agent can act as a process-local results hub when enabled. The browser UI
should treat result descriptors as internal references, not answer content.

Rules:

- Do not call `_get_result` or `_describe_result` from the UI.
- Do not attempt browser-side descriptor resolution.
- Do not expect descriptors to contain large payloads.
- Keep descriptor metadata, `artifact_id`, `args_hash`, and `as_of` values in a
  debug/details view when useful.
- Display `as_of` freshness near relevant tool/provenance details.

The hub store is in-memory and process-local. Multi-replica deployments need
sticky routing or a shared store before descriptors are portable.

## Security Requirements

- Never log bearer tokens.
- Avoid logging full prompts or pasted content because they may contain client
  information.
- Continue using summarized/redacted argument logging patterns.
- Treat `question`, `context`, `instructions`, `asserted_facts`, and
  `pasted_content` as hostile input.
- Render tool arguments behind details disclosures by default.
- Do not expose admin tools in the normal chat surface.
- Clamp `max_steps` in the UI to the server hard cap of 50.
- Do not expose `model_override` for ordinary users unless the backend policy
  and product design explicitly allow it.

## Phase 1 Deliverable

Phase 1 should work against GOFR-Agent as it exists now.

Implementation scope:

1. Add GOFR-Agent to UI config so Vite proxies `/api/gofr-agent`.
2. Add the official MCP TypeScript SDK through pnpm.
3. Add an SDK-backed GOFR-Agent client with bearer auth, logging notification
   handling, `setLoggingLevel("info")`, and text-JSON parsing.
4. Add typed API wrappers for `ping`, `list_services`, `ask`, and
   `reset_session`.
5. Add GOFR-Agent types for requests, responses, reasoning events, gaps,
   clarifications, provenance, and local chat turns.
6. Build the chat page with token selection, connection state, composer,
   `max_steps`, output format, tools-only/no-commentary controls, busy state,
   reset, and error recovery.
7. Render live reasoning trace from `notifications/message` while `ask` is in
   flight.
8. Render services/capabilities, degraded service errors, tool counts, and hub
   capability flags.
9. Render final answer metadata, verification gaps, clarification requests, and
   provenance details.
10. Add route, service shell navigation, dashboard entry, and module status
    behavior.
11. Add focused tests before broad styling work.
12. Run `./scripts/code-quality.sh`, targeted unit tests, and `git diff --check`.

Phase 1 non-goals:

- Mid-run user-input submission.
- Browser-side descriptor resolution.
- Admin controls for registering or refreshing downstream services.
- Model override controls for ordinary users.
- Persistent cross-browser chat history.

## Later Enhancements

Potential later work after Phase 1 is stable:

- Persist chat history per user if product requirements call for it.
- Add richer provenance filtering and export.
- Add admin-only service registration and discovery refresh pages.
- Migrate other console MCP integrations to the official SDK if it reduces
  maintenance cost.
- Add true human-in-the-loop controls after public backend tools exist.

## Test Plan

Unit tests:

- Text-JSON parsing accepts valid MCP text responses.
- Text-JSON parsing rejects missing or invalid text content.
- The reducer appends events by pending turn before `request_id` is known.
- The reducer appends events by `request_id` after final response.
- Event sorting uses `sequence`.
- `verification_gap` maps to a verification-gap turn status.
- `clarification_request` maps to a clarification-requested turn status.
- `run_failed` preserves the trace and marks the turn failed.
- Reserved hub tools are hidden or ignored if returned by a service list.
- `max_steps` is clamped to the server hard cap.

Component tests:

- Initial settings render with token selection and agent controls.
- Successful `ping` shows connected state.
- Unauthorized `ping` shows auth recovery state.
- Missing token shows needs-token state.
- `list_services` renders degraded services without crashing.
- Sending a question appends user and assistant turns.
- A `tool_call` notification appears in the trace before final answer.
- A final answer renders model, tokens, and request id metadata.
- Reset calls `reset_session` and clears local turns.

Integration tests with a mocked MCP client:

- `ask` success with live events and final answer.
- `ask` response containing `verification_gap`.
- `ask` response containing `clarification_request`.
- Transport/network error.
- `run_failed` notification followed by a rejected `ask` promise.

End-to-end checks when GOFR-Agent is available:

1. Select a token.
2. Verify health is connected.
3. Verify services load.
4. Ask `What tools are available?`.
5. Confirm an assistant answer appears.
6. Confirm at least one reasoning event or completed step is visible.
7. Reset the session and confirm the transcript clears.

## Open Questions

- Should GOFR-Agent use existing GOFR JWT tokens from `tokenStore`, a separate
  short-lived agent token, or both?
- Should chat turns persist across reloads, or only for the active tab session?
- Should GOFR-Agent appear as a top-level dashboard module immediately, or be
  gated behind Operations until auth and service availability are stable?
- What browser/proxy timeout should wrap `ask`, given the backend agent timeout
  default is 120 seconds?
- Should the SDK-backed client remain GOFR-Agent-specific, or should the shared
  console MCP client migrate to the SDK in the same effort?
- Which users, if any, are authorized to use `model_override`?

## Risks

- The existing hand-written MCP client is not enough for GOFR-Agent unless it
  gains auth-aware initialization and notification handling.
- Long-running `ask` calls can still feel stalled if no reasoning notifications
  arrive; the UI needs clear busy and timeout states.
- In-memory server sessions expire after idle TTL and will be lost on backend
  restart.
- Results hub descriptors are process-local; multi-replica deployments can
  break descriptor portability without sticky routing or shared storage.
- Rich rendering of model output can introduce XSS risk if sanitized rendering
  is not designed carefully.
- Adding the MCP SDK beside the existing client creates two transport paths;
  the boundary should stay small and well typed.

## Recommendation

Proceed with Phase 1 as an SDK-backed GOFR-Agent workbench that uses the
current MCP tools and live reasoning notifications. Keep the UI honest about
what the backend supports today: final answers, reasoning progress,
verification gaps, clarification requests, provenance, and reset are in scope;
mid-run browser responses, descriptor resolution, and admin service management
are not.
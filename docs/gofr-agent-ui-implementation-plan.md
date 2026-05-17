# Implementation plan: GOFR-Agent Console UI

Status: implemented; live backend integration blocked by GOFR-Agent Host header allowlist
Source proposal: `docs/gofr-agent-ui-proposal.md`
Target release: Phase 1 workbench only

## Execution notes

- DONE: Added MCP SDK dependency and pinned pnpm package manager state.
- DONE: Added GOFR-Agent Vite proxy config source entry using `/api/gofr-agent/mcp` and the confirmed reachable Docker hostname `gofr-agent-dev`.
- DONE: Added domain types, SDK-backed client, parser/normalizers, API wrappers, chat reducer, hook, page, components, route, ServiceShell help, dashboard card, and focused unit tests.
- DONE: Added unauthenticated HTTP `/ping` and `/health` probes before tokened MCP checks, plus tokened MCP `health_check` typing and degraded/unhealthy readiness handling.
- DONE: Added a fallback for currently deployed GOFR-Agent images that return `404` for HTTP `/ping` or `/health`; tokened MCP checks still run when a token is selected.
- DONE: Applied `tmp/answers.md` readiness guidance: HTTP ping and health are handled separately, MCP `health_check` drives runtime max-step/question/context limits, and diagnostics show selected model, feature counts, hub flags, and downstream health states.
- DONE: Applied updated Host-header guidance from `tmp/answers.md`: `421 Invalid Host header` is surfaced as a backend FastMCP `allowed_hosts` deployment issue, not token auth, and the health panel shows non-secret MCP endpoint host/path diagnostics.
- DONE: Added a non-persisted GOFR-Agent token override and a Vite-dev-only `GOFR-Agent dev admin` Agent Token dropdown option for local dev auth; SDK smoke test through Vite with `Authorization: Bearer dev-admin-token` returned MCP `ping` ok.
- DONE: Added minimal `waiting_for_user` ask-response rendering so pending human-input prompts are not shown as empty final answers.
- DONE: Verified with `./scripts/code-quality.sh`, `pnpm run test:unit`, `pnpm run build`, `git diff --check`, and VS Code diagnostics.
- BLOCKED: Manual live chat validation cannot complete until GOFR-Agent allows the proxy target Host header for `gofr-agent-dev:8090` or provides a stable accepted Docker service alias.
- DEFERRED: React component tests are not added in this pass because the repo does not currently include Testing Library dependencies; pure parser/API/reducer coverage was added without expanding the dependency footprint.

## Purpose

Implement GOFR-Agent as a first-class GOFR Console module with an SDK-backed
MCP client, bearer-authenticated chat workflow, live reasoning trace, typed
responses, provenance details, routing, dashboard entry, and focused tests.

The first screen must be the actual chat workbench at `/gofr-agent`. Do not add
a landing page or explanatory splash screen.

## Peer review notes

These review findings are baked into the phases below:

- Do not fall back to the existing hand-written `McpClient` for GOFR-Agent.
  The Phase 1 requirement is an SDK-backed client with bearer auth and logging
  notification handling.
- Treat live-backend availability as required for integration checks, not for
  all type/reducer/UI work. If GOFR-Agent is unavailable, record that fact and
  proceed only with mock-backed implementation steps until integration is
  possible.
- Filter reserved/admin tools at both API-normalization and UI-rendering
  boundaries, then test those filters.
- Review every new logger/error path for accidental token, prompt, pasted
  content, or client-data leakage.
- Account for the current Vite proxy behavior: proxy targets are generated at
  dev-server startup from `data/config/ui-config.json` and use `ports.prod.mcp`.

## Phase 0 - Baseline, hygiene, and contract check

Goal: start from a known baseline and confirm the backend assumptions before any
UI or client code changes.

- [ ] Review current working tree with `git status --short`.
- [ ] Identify files already modified by the user and avoid overwriting them.
- [ ] Confirm `package.json` has a pinned `packageManager` so pnpm resolves
  consistently through Corepack.
- [ ] Run baseline code quality:
  - [ ] `./scripts/code-quality.sh`
  - [ ] `pnpm run test:unit`
  - [ ] `pnpm run build`
- [ ] Review `tmp/gofr-agent.md` and compare it with
  `docs/gofr-agent-ui-proposal.md`.
- [ ] Confirm GOFR-Agent MCP host and port on `gofr-net`.
  - Expected MCP path: `/mcp`
  - Expected MCP port: `8090`
  - Expected proxy path in browser: `/api/gofr-agent/mcp`
  - Expected token header: `Authorization: Bearer <token>`
- [ ] Confirm actual Docker service hostname before editing config.
  - Proposal value: `gofr-agent`
  - If the deployed MCP container is named `gofr-agent-mcp`, use that instead.
  - Do not use `localhost` or `127.0.0.1` in app or Vite proxy config.
- [ ] Write the confirmed hostname and proxy path in this plan or a short
  adjacent note before editing `data/config/ui-config.json`.
- [ ] Confirm public tools available for Phase 1:
  - [ ] `ping`
  - [ ] `list_services`
  - [ ] `ask`
  - [ ] `reset_session`
- [ ] Confirm reserved/admin tools are not part of normal UI scope:
  - [ ] `register_service`
  - [ ] `refresh_services`
  - [ ] `_store_result`
  - [ ] `_get_result`
  - [ ] `_describe_result`
  - [ ] `_register_results_hub`

Acceptance:

- Baseline results are recorded before implementation starts.
- GOFR-Agent service hostname is confirmed or explicitly called out as blocking
  live integration.
- If backend contract verification is blocked, type/reducer/component work may
  proceed only against the documented contract and mocked SDK boundary.

## Phase 1 - Dependency and configuration

Goal: make the browser route to GOFR-Agent through the existing Vite proxy and
add the official MCP SDK dependency.

### 1.1 Add MCP SDK

- [ ] Add the official SDK with pnpm:
  - [ ] `pnpm add @modelcontextprotocol/sdk`
- [ ] Inspect installed SDK types before writing client code.
  - [ ] Confirm client import path, expected from guide:
    `@modelcontextprotocol/sdk/client/index.js`.
  - [ ] Confirm Streamable HTTP transport import path, expected from guide:
    `@modelcontextprotocol/sdk/client/streamableHttp.js`.
  - [ ] Confirm how request headers are supplied in browser transport.
  - [ ] Confirm logging notification handler API.
  - [ ] Confirm client close/disconnect API for token changes and unmount.
- [ ] Keep dependency changes limited to `package.json` and `pnpm-lock.yaml`.
- [ ] Pin the added dependency through pnpm lockfile output; do not hand-edit
  dependency versions.

Acceptance:

- `pnpm-lock.yaml` is updated by pnpm, not hand-edited.
- No existing package manager or React/Vite dependencies are changed
  unnecessarily.

### 1.2 Add GOFR-Agent to UI config

- [ ] Update `data/config/ui-config.json` under `mcpServices`.
- [ ] Add service entry with:
  - [ ] `name`: `gofr-agent`
  - [ ] `displayName`: `GOFR-Agent`
  - [ ] `containerHostname`: confirmed GOFR-Agent MCP hostname
  - [ ] prod ports: `mcp: 8090`, `mcpo: 8091`, `web: 8092`
  - [ ] dev ports: `mcp: 8090`, `mcpo: 8091`, `web: 8092`
- [ ] Do not add tokens to UI config.
- [ ] Verify the existing Vite config generates `/api/gofr-agent` from this
  entry.
- [ ] Restart the Vite dev server after editing config; generated proxy targets
  are evaluated at server startup.
- [ ] Remember current `vite.config.ts` uses `ports.prod.mcp` for proxy targets
  even when the UI environment switch is set to dev.
- [ ] Do not add a hand-written Vite proxy entry unless generated config cannot
  support this service.

Acceptance:

- `tests/code_quality/test_ui_config_schema.test.ts` still passes.
- Vite config resolves a proxy target for `/api/gofr-agent`.
- Browser-facing code only uses `/api/gofr-agent/mcp`.

## Phase 2 - Agent domain types

Goal: add a complete local TypeScript contract before writing the client or UI.

- [ ] Create `src/types/gofrAgent.ts`.
- [ ] Add request/response types:
  - [ ] `AgentPingResponse`
  - [ ] `AgentServiceStatus`
  - [ ] `AgentListServicesResponse`
  - [ ] `AgentAskRequest`
  - [ ] `AgentAskResponse`
  - [ ] `AgentResetSessionResponse`
- [ ] Model the full `ask` request payload:
  - [ ] `question`
  - [ ] `session_id`
  - [ ] `context`
  - [ ] `instructions`
  - [ ] `asserted_facts`
  - [ ] `pasted_content`
  - [ ] `forbidden_services`
  - [ ] `forbidden_tools`
  - [ ] `allowed_services`
  - [ ] `tools_only`
  - [ ] `output_format`
  - [ ] `no_commentary`
  - [ ] `max_steps`
  - [ ] `model_override`
- [ ] Add response detail types:
  - [ ] `AgentReasoningEvent`
  - [ ] `AgentVerificationGap`
  - [ ] `AgentClarificationRequest`
  - [ ] `AgentProvenanceRecord`
  - [ ] `AgentToolAttempt`
  - [ ] `AgentArtifactDescriptor`
- [ ] Add UI state types:
  - [ ] `AgentConnectionState`
  - [ ] `AgentTurnRole`
  - [ ] `AgentTurnStatus`
  - [ ] `AgentTurn`
  - [ ] `AgentChatSettings`
  - [ ] `AgentChatState`
- [ ] Add constants:
  - [ ] default max steps: `10`
  - [ ] hard max steps: `50`
  - [ ] question max length: `8000`
  - [ ] combined context/content max length: `16000`
  - [ ] default output format: `text`
  - [ ] reasoning logger: `gofr-agent.reasoning`
- [ ] Type all current reasoning event kinds from the integration guide:
  - [ ] `run_started`
  - [ ] `step_started`
  - [ ] `text_delta`
  - [ ] `tool_call`
  - [ ] `tool_retry`
  - [ ] `tool_result`
  - [ ] `summary_update`
  - [ ] `step_completed`
  - [ ] `run_completed`
  - [ ] `run_failed`
- [ ] Type future human-input event shapes defensively, but do not expose
  pause/resume UI.

Acceptance:

- Types compile without importing React.
- Domain types do not expose secrets or token fields in display models.
- `model_override` is typed but not exposed in ordinary UI controls.

## Phase 3 - SDK-backed MCP client

Goal: implement a small GOFR-Agent-specific SDK client that supports bearer
auth and live logging notifications without changing the existing generic MCP
client for other services.

### 3.1 Add client module

- [ ] Create `src/services/gofrAgent/client.ts`.
- [ ] Use the official MCP TypeScript SDK client.
- [ ] Do not use or extend the existing generic `McpClient` for GOFR-Agent in
  Phase 1.
- [ ] If a later decision reuses the generic client, stop and first add bearer
  auth to initialize/notifications, robust notification handling, and an
  agent-specific timeout strategy.
- [ ] Use the SDK Streamable HTTP browser transport for
  `/api/gofr-agent/mcp`.
- [ ] Send `Authorization: Bearer <token>` on every MCP request.
- [ ] Do not include token values in logger data, errors, or thrown messages.
- [ ] Keep SDK MCP session separate from GOFR-Agent `session_id`.
- [ ] Provide a client lifecycle API:
  - [ ] connect with token
  - [ ] disconnect/reset transport
  - [ ] call tool
  - [ ] register notification callback
  - [ ] set logging level to `info`
- [ ] Register the notification handler before the first `ask` call.
- [ ] Recreate the SDK client when selected token changes.
- [ ] Abort or close the previous client when token changes or page unmounts.

### 3.2 Add parsing helpers

- [ ] Create `src/services/gofrAgent/parse.ts`.
- [ ] Parse MCP text content containing JSON.
- [ ] Reject missing text content with a typed `ApiError` or agent-specific
  error wrapper.
- [ ] Reject invalid JSON with a user-safe error message and a short raw
  snippet only if it cannot contain prompt/token content.
- [ ] Normalize tool-level errors into recoverable UI states.
- [ ] Do not parse or render unsafe HTML from model answers.

### 3.3 Add notification handling

- [ ] Register notification handling immediately after SDK client connects.
- [ ] Accept only `notifications/message` events with logger
  `gofr-agent.reasoning`.
- [ ] Convert accepted notifications into `AgentReasoningEvent`.
- [ ] Ignore unknown loggers without throwing.
- [ ] Preserve unknown future agent event kinds in a safe debug shape.
- [ ] Sort events by `sequence`, not arrival time.
- [ ] Use `event_id` as the stable React key when present.

Acceptance:

- Existing `src/services/api/index.ts` remains the transport for existing
  modules.
- GOFR-Agent client does not hand-roll JSON-RPC/SSE.
- Auth headers are present for initialize, notifications, and tool calls.
- Notifications are available to the chat reducer while `ask` is in flight.

## Phase 4 - Typed GOFR-Agent API wrappers

Goal: expose a small typed API surface for UI code.

- [ ] Create `src/services/gofrAgent/api.ts`.
- [ ] Export these functions:
  - [ ] `agentPing(authToken: string): Promise<AgentPingResponse>`
  - [ ] `agentListServices(authToken: string): Promise<AgentListServicesResponse>`
  - [ ] `agentAsk(authToken: string, request: AgentAskRequest, onEvent: ...)`
  - [ ] `agentResetSession(authToken: string, sessionId: string)`
- [ ] Clamp `max_steps` to `1..50` before sending.
- [ ] Trim `question` and reject empty submissions before sending.
- [ ] Reject or clearly message questions over the documented 8000 character
  limit before sending.
- [ ] If advanced context fields are added later, enforce the documented 16000
  character combined context/content limit before sending.
- [ ] Do not send empty optional fields.
- [ ] Keep `tools_only`, `no_commentary`, and `output_format` explicit.
- [ ] Add an API-layer normalizer for `list_services` that filters reserved and
  admin-only tools from user-action surfaces:
  - [ ] `register_service`
  - [ ] `refresh_services`
  - [ ] `_store_result`
  - [ ] `_get_result`
  - [ ] `_describe_result`
  - [ ] `_register_results_hub`
- [ ] Add `src/services/gofrAgent/index.ts` to re-export public wrappers.
- [ ] Use the existing `ApiError`/`ToolErrorAlert` conventions where they fit.
- [ ] Add helper to map failures into connection states:
  - [ ] no token: `needs-token`
  - [ ] 401/403: `unauthorized`
  - [ ] timeout/network: `unavailable`
  - [ ] success: `connected`
  - [ ] config/proxy issue: `misconfigured`

Acceptance:

- Page code does not call MCP SDK directly.
- Page code receives typed responses and typed reasoning events.
- Transport failures are separate from successful agent outcomes such as
  `verification_gap` and `clarification_request`.

## Phase 5 - Chat reducer and hook

Goal: build state management before visual components so behavior can be tested
without rendering the full page.

### 5.1 Add pure reducer

- [ ] Create `src/stores/gofrAgentChatReducer.ts` or
  `src/hooks/gofrAgentChatReducer.ts`.
- [ ] Add actions:
  - [ ] initialize session
  - [ ] select token
  - [ ] update settings
  - [ ] append user turn
  - [ ] create pending assistant turn
  - [ ] receive reasoning event
  - [ ] receive final answer
  - [ ] receive verification gap
  - [ ] receive clarification request
  - [ ] mark run failed
  - [ ] mark transport failed
  - [ ] reset local transcript
  - [ ] reset server session complete
- [ ] Generate initial local `session_id` with `crypto.randomUUID()`.
- [ ] Reuse the returned `session_id` after each `ask` response.
- [ ] Append the user turn immediately on send.
- [ ] Create a pending assistant turn before calling `ask`.
- [ ] Attach pre-final notifications to the pending assistant turn.
- [ ] After final response arrives, bind the assistant turn to `request_id`.
- [ ] Reconcile final `steps` with live events already displayed.
- [ ] Mark `run_failed` as a failed assistant turn and preserve its trace.
- [ ] Keep `text_delta` as optional live draft only.
- [ ] Use final `answer` from `ask` as the authoritative response.

### 5.2 Add React hook

- [ ] Create `src/hooks/useGofrAgentChat.ts`.
- [ ] Subscribe to tokens with `useTokens()`.
- [ ] Store selected token index locally in hook state or a tiny store.
- [ ] Derive selected token value without exposing it to child components that
  only need display state.
- [ ] Load connection state with `agentPing` when token changes.
- [ ] Load capabilities with `agentListServices` after ping succeeds.
- [ ] Provide `sendQuestion()` that:
  - [ ] validates non-empty question
  - [ ] validates question length
  - [ ] appends user turn
  - [ ] creates pending assistant turn
  - [ ] calls `agentAsk`
  - [ ] streams reasoning events into reducer
  - [ ] stores final answer/gap/clarification/provenance
  - [ ] handles transport failure as recoverable UI error
- [ ] Provide `resetSession()` that:
  - [ ] calls backend `reset_session` when token and session id exist
  - [ ] clears local transcript
  - [ ] generates a new local session id
  - [ ] handles reset failure without losing visible transcript unless the user
    confirms local clear
- [ ] Clean up SDK client on unmount.
- [ ] Prevent concurrent `ask` calls for the same session in Phase 1.

Acceptance:

- Reducer is testable without DOM.
- Hook exposes stable props for components.
- Token changes do not leak prior session events into the new token session.

## Phase 6 - Chat workbench page and components

Goal: implement the actual operations workbench with dense, calm UI consistent
with existing MUI service pages.

### 6.1 Page shell

- [ ] Create `src/pages/GofrAgent.tsx`.
- [ ] First viewport contains the working chat interface, not a feature intro.
- [ ] Use `ServiceShell` from routing, not a nested app shell.
- [ ] Use a two-column desktop layout:
  - [ ] main column: transcript and composer
  - [ ] side column: connection, capabilities, selected turn details
- [ ] Use a single-column mobile layout with side panels stacked below chat.
- [ ] Do not nest UI cards inside other cards.
- [ ] Avoid oversized hero typography and marketing copy.

### 6.2 Token and connection controls

- [ ] Use `TokenSelect` for token selection.
- [ ] Show connection state near the composer or header.
- [ ] Add refresh action for ping/capabilities.
- [ ] States to show:
  - [ ] connected
  - [ ] needs token
  - [ ] unauthorized
  - [ ] unavailable
  - [ ] misconfigured
- [ ] Auth failures should route the user toward Operations/token management,
  not expose token details.

### 6.3 Composer

- [ ] Create `src/components/agent/AgentComposer.tsx`.
- [ ] Include multiline question input.
  - [ ] Show remaining/over-limit character count based on the 8000 character
    question limit.
- [ ] Include send icon button.
- [ ] Include reset icon button.
- [ ] Include refresh/status icon button where useful.
- [ ] Add output format segmented control: `text` and `json`.
- [ ] Add numeric input or stepper for `max_steps`.
- [ ] Clamp `max_steps` to `1..50` in UI and API wrapper.
- [ ] Add toggles for `tools_only` and `no_commentary`.
- [ ] Disable send while no token, no question, or an ask is in flight.
- [ ] Disable send when question is over the client-side limit.
- [ ] Keep advanced fields hidden for Phase 1:
  - [ ] `context`
  - [ ] `instructions`
  - [ ] `asserted_facts`
  - [ ] `pasted_content`
  - [ ] allow/deny service/tool lists
  - [ ] `model_override`

### 6.4 Transcript

- [ ] Create `src/components/agent/AgentChatThread.tsx`.
- [ ] Render user turns as plain text.
- [ ] Render assistant final answer as plain text.
- [ ] Render pending assistant state with visible busy indicator.
- [ ] Render `verification_gap` as a successful assistant outcome with a
  distinct status.
- [ ] Render `clarification_request` as an assistant ask-back.
- [ ] Let the user answer clarification by sending a normal follow-up `ask` in
  the same `session_id`.
- [ ] Do not render model output with unsafe HTML.
- [ ] Do not introduce a markdown renderer in Phase 1 unless a sanitized and
  reviewed renderer is selected.

### 6.5 Live reasoning trace

- [ ] Create `src/components/agent/AgentRunTrace.tsx`.
- [ ] Show ordered reasoning events for the active assistant turn.
- [ ] Highlight event kinds such as:
  - [ ] run started
  - [ ] tool call
  - [ ] tool result
  - [ ] text delta
  - [ ] run failed
  - [ ] run complete
- [ ] Show unknown event kinds in a safe generic row.
- [ ] Keep raw event JSON behind a disclosure.
- [ ] Do not show large tool arguments by default.

### 6.6 Capabilities panel

- [ ] Create `src/components/agent/AgentCapabilitiesPanel.tsx`.
- [ ] Render `list_services` response.
- [ ] Show service availability and degraded states.
- [ ] Show tool counts by service.
- [ ] Hide admin and reserved hub tools from normal action surfaces even if the
  API layer already filtered them.
- [ ] Show hub capability flags as details only.
- [ ] Add refresh action that reloads capabilities without resetting chat.

### 6.7 Turn metadata and provenance

- [ ] Create `src/components/agent/AgentTurnMetadata.tsx`.
- [ ] Show per-turn metadata when present:
  - [ ] `request_id`
  - [ ] `session_id`
  - [ ] model
  - [ ] tokens used
  - [ ] duration
  - [ ] source summary
- [ ] Create `src/components/agent/AgentProvenancePanel.tsx`.
- [ ] Show provenance records behind disclosures.
- [ ] Show tool attempts and freshness values such as `as_of`.
- [ ] Show artifact descriptors as internal references, not as resolved content.
- [ ] Do not call `_get_result` or `_describe_result` from the UI.
- [ ] Include raw debug JSON behind an explicit disclosure.

Acceptance:

- A user can select a token, ask a question, watch progress, inspect details,
  and continue the same server-side session.
- UI remains usable if capabilities fail but chat connection is otherwise valid.
- UI does not expose admin tools, hidden hub tools, tokens, or unsafe HTML.

## Phase 7 - Routing, navigation, help, and dashboard

Goal: make GOFR-Agent reachable as a normal console module.

### 7.1 Routes and service navigation

- [ ] Update `src/App.tsx` imports for GOFR-Agent page(s).
- [ ] Add an icon import appropriate for chat/capabilities navigation.
- [ ] Add GOFR-Agent nav items:
  - [ ] `/gofr-agent` labeled `Chat`
  - [ ] `/gofr-agent/capabilities` labeled `Capabilities` only if the
    capabilities panel is implemented as a separate page
- [ ] Add `<Navigate>` from any default sub-route back to `/gofr-agent`.
- [ ] Add an explicit `/gofr-agent` route; do not rely on the default GOFR-IQ
  `ServiceShell` nav items.
- [ ] Wrap routes in `RequireAuth` and `ServiceShell`.
- [ ] Add GOFR-Agent quick-start text to `ServiceShell`.
- [ ] Keep the quick-start concise and operational.

Acceptance:

- `/gofr-agent` opens the chat workbench.
- ServiceShell back navigation returns to Dashboard.
- Route change logging continues to work.

### 7.2 Dashboard module card

- [ ] Extend dashboard module status types to include:
  - [ ] checking
  - [ ] online
  - [ ] needs-token
  - [ ] unauthorized
  - [ ] offline
- [ ] Add GOFR-Agent to dashboard services.
- [ ] Add GOFR-Agent to the dashboard status check list without changing status
  semantics for existing modules.
- [ ] Add a preferred-token helper for dashboard status.
  - [ ] Prefer token named `all`.
  - [ ] Then token named `admin`.
  - [ ] Then first token with a token value.
  - [ ] If none exists, show `needs-token`.
- [ ] Ping GOFR-Agent with the preferred token when available.
- [ ] Use the GOFR-Agent SDK/API wrapper for dashboard ping; do not route this
  through the generic unauthenticated `api.mcpPing` helper.
- [ ] Map 401/403 to `unauthorized`.
- [ ] Map transport failures to `offline`.
- [ ] Route card and next action to `/gofr-agent`.
- [ ] Do not log or display the token used for dashboard ping.

Acceptance:

- Dashboard shows GOFR-Agent as configured even when no token exists.
- Dashboard does not hang if GOFR-Agent is unavailable.
- Dashboard state differentiates missing token, unauthorized token, and offline
  service.

## Phase 8 - Security, logging, and UI hardening

Goal: finish behavior that protects tokens, prompts, client data, and browser
rendering.

- [ ] Review all new logger calls.
- [ ] Peer-review all new logging and error handling before merge.
- [ ] Never log bearer tokens.
- [ ] Never log full prompts, pasted content, context, instructions, asserted
  facts, or model answers.
- [ ] Log only summarized argument shapes and safe operational metadata.
- [ ] Treat all prompt and tool data as hostile input.
- [ ] Render all model output and tool arguments as text or JSON, not HTML.
- [ ] Keep raw/debug JSON behind disclosures.
- [ ] Cap visible raw snippets to a safe length.
- [ ] Ensure `max_steps` cannot exceed 50 in UI or API wrapper.
- [ ] Ensure admin and hidden hub tools are filtered from normal surfaces.
- [ ] Ensure `model_override` is not exposed to ordinary users.
- [ ] Ensure reset cannot accidentally submit an empty `session_id`.
- [ ] Add error states with recovery options for:
  - [ ] missing token
  - [ ] unauthorized token
  - [ ] service unavailable
  - [ ] malformed MCP response
  - [ ] misconfigured proxy or CORS/deployment issue
  - [ ] agent run failure
  - [ ] session reset failure

Acceptance:

- Security review finds no token/prompt logging.
- Browser UI cannot execute model-provided markup.
- Error messages are actionable without exposing secrets.

## Phase 9 - Tests

Goal: cover the behavior with focused tests before broad styling polish.

### 9.1 Pure unit tests

- [ ] Add tests for `src/services/gofrAgent/parse.ts`:
  - [ ] accepts valid MCP text JSON
  - [ ] rejects missing text content
  - [ ] rejects invalid JSON safely
  - [ ] handles double-encoded JSON if backend returns it
  - [ ] maps tool-level errors to recoverable failures
- [ ] Add boundary tests for request validation:
  - [ ] empty question rejected
  - [ ] over-limit question rejected
  - [ ] `max_steps` below 1 normalized or rejected consistently
  - [ ] `max_steps` above 50 clamped
- [ ] Add tests for chat reducer:
  - [ ] appends user turn immediately
  - [ ] creates pending assistant turn
  - [ ] attaches events before `request_id` is known
  - [ ] attaches events by `request_id` after final answer
  - [ ] sorts events by `sequence`
  - [ ] uses `event_id` for stable keys
  - [ ] maps `verification_gap` to correct status
  - [ ] maps `clarification_request` to correct status
  - [ ] preserves trace on `run_failed`
  - [ ] clears local state on reset
  - [ ] clamps `max_steps` to 50
- [ ] Add tests for reserved tool filtering:
  - [ ] API normalizer filters admin tools
  - [ ] API normalizer filters hub tools
  - [ ] UI rendering also hides admin tools if they reach the component
  - [ ] UI rendering also hides hub tools if they reach the component
  - [ ] unknown tools displayed only as capability metadata if safe

### 9.2 API wrapper tests with mocked client

- [ ] Mock the SDK-backed client boundary.
- [ ] Test `agentPing` success.
- [ ] Test unauthorized ping mapping.
- [ ] Test unavailable ping mapping.
- [ ] Test misconfigured proxy/CORS-style failure mapping.
- [ ] Test `agentListServices` degraded-service response.
- [ ] Test `agentAsk` success with live events and final answer.
- [ ] Test `agentAsk` with `verification_gap`.
- [ ] Test `agentAsk` with `clarification_request`.
- [ ] Test transport/network error.
- [ ] Test `run_failed` notification followed by rejected `ask`.

### 9.3 Component tests

- [ ] Check whether Testing Library dependencies already exist.
- [ ] If absent, add only the minimum maintained dev dependencies needed for
  React component tests, or record why component tests are deferred.
- [ ] Test token selection and disabled send state.
- [ ] Test successful connected state.
- [ ] Test missing-token state.
- [ ] Test unauthorized state.
- [ ] Test unavailable/misconfigured state.
- [ ] Test sending a question appends user and assistant turns.
- [ ] Test live `tool_call` event appears before final answer.
- [ ] Test final metadata renders request id, model, and token count.
- [ ] Test reset clears transcript after backend reset succeeds.

Acceptance:

- Required pure unit tests pass without browser/backend dependencies.
- Component tests are either implemented or explicitly deferred with rationale.
- No new large files exceed code quality limits.

## Phase 10 - Manual integration checks

Goal: validate against a running GOFR-Agent service when it is available.

- [ ] Start UI with `./scripts/start-ui.sh --background --timeout 30`.
- [ ] Open the app through the forwarded browser URL.
- [ ] Sign in through existing console auth.
- [ ] Open `/gofr-agent`.
- [ ] Select a token.
- [ ] Verify connection state becomes connected.
- [ ] Verify capabilities load.
- [ ] Ask `What tools are available?`.
- [ ] Confirm assistant answer appears.
- [ ] Confirm at least one reasoning event or completed step is visible.
- [ ] Confirm metadata includes `request_id` when backend returns it.
- [ ] Send a follow-up question and confirm same `session_id` is used.
- [ ] Trigger reset and confirm transcript clears.
- [ ] Confirm backend session reset succeeds or shows recoverable error.
- [ ] Stop UI with `./scripts/start-ui.sh --stop` if it was started only for
  validation.

Acceptance:

- Chat, progress, capabilities, provenance, and reset are usable end to end.
- UI remains responsive when GOFR-Agent is offline or unauthorized.

## Phase 11 - Final verification

Goal: finish with repo checks and a reviewable diff.

- [ ] Run targeted tests:
  - [ ] `pnpm exec vitest run tests/gofr_agent -v`
- [ ] If component tests were added outside `tests/gofr_agent`, run their
  matching targeted Vitest command too.
- [ ] Run full test suite:
  - [ ] `pnpm run test:unit`
- [ ] Run code quality:
  - [ ] `./scripts/code-quality.sh`
- [ ] Run production build:
  - [ ] `pnpm run build`
- [ ] Run diff whitespace check:
  - [ ] `git diff --check`
- [ ] Optional before commit or release:
  - [ ] `pnpm run security`
- [ ] Review `git diff --stat` and split any oversized files before handoff.
- [ ] Review `git diff` for token logging, prompt logging, unsafe rendering,
  and accidental `localhost` references.

Acceptance:

- All required checks pass or failures are documented with root cause.
- Implementation diff is scoped to GOFR-Agent UI, config, tests, and dependency
  changes.
- No unrelated user changes are reverted.

## Phase 1 acceptance criteria

- `/gofr-agent` is a usable chat workbench, not a landing page.
- Browser uses `/api/gofr-agent/mcp` through Vite proxy.
- SDK-backed MCP client sends bearer auth on all GOFR-Agent MCP requests.
- User can select a token and see connection status.
- User can send a question and receive an answer.
- User can see live reasoning events while `ask` is in flight.
- User can inspect services/capabilities.
- User can inspect metadata, verification gaps, clarification requests, and
  provenance details.
- User can reset the server-side session.
- Dashboard includes GOFR-Agent and distinguishes missing token, unauthorized,
  online, and offline states.
- Admin tools and hidden hub tools are not exposed as user actions.
- Tokens, prompts, and pasted content are not logged.
- `max_steps` is clamped to 50.
- Tests and verification commands pass.

## Explicit non-goals for this implementation

- No mid-run browser input controls.
- No browser-side descriptor resolution.
- No admin service registration page.
- No service discovery refresh controls for ordinary users.
- No `model_override` UI for ordinary users.
- No persistent cross-browser chat history.
- No migration of existing GOFR-IQ, GOFR-DOC, GOFR-DIG, GOFR-PLOT, or GOFR-NP
  clients to the MCP SDK in this pass.
- No direct browser calls to Docker service hostnames.

## Open questions before execution

- What is the confirmed Docker service hostname for GOFR-Agent MCP on
  `gofr-net`: `gofr-agent` or `gofr-agent-mcp`?
- Should GOFR-Agent use existing JWT tokens from `tokenStore`, a separate
  short-lived agent token, or both?
- Should the dashboard use a preferred token automatically, or always show
  `needs-token` until the user opens GOFR-Agent?
- Should capabilities be a side panel only, or also a separate
  `/gofr-agent/capabilities` route?
- What browser timeout should wrap `ask` if backend default timeout is 120
  seconds?
- Should chat turns persist across reloads, or only within the active page
  session for Phase 1?
- Are component test dependencies approved if they are not already installed?

## Suggested implementation order

1. Complete Phase 0 and resolve hostname/token questions.
2. Add SDK dependency and config entry.
3. Add types and pure parsing helpers.
4. Add SDK client and API wrappers.
5. Add reducer and pure unit tests.
6. Build page and components behind `/gofr-agent`.
7. Add routing, ServiceShell help, and dashboard card.
8. Add component/API tests where dependency budget allows.
9. Run manual integration checks.
10. Run final verification.
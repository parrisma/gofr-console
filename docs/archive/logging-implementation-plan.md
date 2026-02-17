# GOFR Console UI Logging Implementation Plan (gofr-seq)

Date: 2026-02-14  
Owner: UI Platform / DevOps  
Status: Execution started

## Objective

Implement production-grade UI activity logging for GOFR Console using gofr-seq, with strong privacy controls, correlation, and reliable delivery that never blocks core user workflows.

## Success Criteria

- Structured frontend logs are emitted through one logger interface.
- Sensitive data is redacted before transport.
- Logs are batched and forwarded to gofr-seq through a defined endpoint/proxy path.
- API/MCP operations include request correlation fields.
- Dashboards exist for failures, latency, and transport health.
- Direct `console.*` usage is removed from app runtime paths (except explicit local debug guards).

---

## Progress Tracking

### Status Legend

- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked

### Program Board

| Workstream | Status | Owner | Target | Evidence |
|---|---|---|---|---|
| WS1 Logger foundation | [x] | Copilot | 2026-02-14 | `src/services/logging/*` |
| WS2 Redaction and schema validation | [x] | Copilot | 2026-02-14 | sanitization+validation + unit tests passing |
| WS3 API correlation and instrumentation | [x] | Copilot | 2026-02-14 | `src/services/api/index.ts` call lifecycle logs |
| WS4 UI page instrumentation | [~] | Copilot | 2026-02-14 | GOFR-DIG pages + global error boundary instrumented |
| WS5 gofr-seq transport/proxy wiring | [~] | Copilot | 2026-02-14 | `vite.config.ts` + `docker/nginx.conf` + transport |
| WS6 Dashboards and alert checks | [ ] |  |  |  |
| WS7 Hardening and rollout | [ ] |  |  |  |

---

## Workstreams and Checklists

## WS1 — Logger Foundation

### Deliverables

- [x] Create `src/services/logging/types.ts` with canonical event schema and enums.
- [x] Create `src/services/logging/logger.ts` with `debug/info/warn/error` wrappers.
- [x] Create `src/services/logging/context.ts` for `session_id`, route, env, and base metadata.
- [x] Add lightweight no-op fallback when transport is disabled.

### Acceptance Checks

- [ ] Unit test: event object always includes required base fields.
- [ ] Unit test: logger does not throw when transport is unavailable.
- [ ] Code review check: no page/component imports transport directly (only logger API).

### Evidence

- PR links:
- Test output: `npx tsc --noEmit` passed (2026-02-14).

---

## WS2 — Redaction and Schema Validation

### Deliverables

- [x] Add key-based redaction (`token`, `authorization`, `secret`, `password`, `api_key`, `cookie`).
- [x] Add value-based redaction (JWT-like and high-entropy credential-like strings).
- [x] Add URL sanitizer to strip query params unless allowlisted.
- [x] Add event validation function for required fields and max sizes.

### Acceptance Checks

- [x] Unit test: JWT and auth header values are redacted.
- [x] Unit test: oversized fields are truncated safely.
- [x] Unit test: query params are removed by default.
- [ ] Security review sign-off: no known secret path leaks.

### Evidence

- PR links:
- Test output: `pnpm test:unit` passed (7 tests); `npx tsc --noEmit` passed.

---

## WS3 — API Correlation and Instrumentation

### Deliverables

- [x] Add per-operation `request_id` generation in `src/services/api/index.ts` wrapper path.
- [x] Emit `api_call_started`, `api_call_succeeded`, `api_call_failed`, `api_call_timed_out`.
- [x] Add normalized `operation`, `tool_name`, `service_name`, `duration_ms`, `error_code` fields.
- [x] Ensure failures include actionable `message` and dependency metadata.

### Acceptance Checks

- [ ] Integration test: one request_id appears across start/end/fail events for same action.
- [ ] Spot check: gofr-dig calls include sanitized argument summaries only.
- [ ] Spot check: errors include `operation`, `result=failure`, and `error_code` when available.

### Evidence

- PR links:
- Test output: `npx tsc --noEmit` passed after API lifecycle instrumentation.

---

## WS4 — UI Page Instrumentation

### Priority Pages

1. `src/pages/GofrDig.tsx`
2. `src/pages/GofrDigSessions.tsx`
3. `src/pages/GofrDigHealthCheck.tsx`
4. `src/pages/GofrIQ.tsx` and high-traffic IQ pages

### Deliverables

- [x] Emit `ui_page_view` and key `ui_action_*` events for primary actions.
- [~] Instrument tab changes, submit actions, and major toggles.
- [x] Add error boundary/unhandled UI error logging path.
- [ ] Keep event names stable and documented.

### Acceptance Checks

- [ ] Manual test: key user journey emits expected event chain.
- [ ] Manual test: no sensitive form content appears in emitted payload.
- [ ] Lint check: direct `console.log|warn|error` removed from runtime paths.

### Evidence

- PR links:
- Test output: GOFR-DIG pages + route-change + global error boundary logging added; manual flow test pending.

---

## WS5 — gofr-seq Transport and Proxy Wiring

### Deliverables

- [x] Define transport endpoint contract for gofr-seq ingestion.
- [x] Add Vite dev proxy route for gofr-seq endpoint.
- [x] Add nginx prod route for gofr-seq endpoint (if proxied through console).
- [x] Implement batching, retry with backoff+jitter, bounded queue, and `sendBeacon` flush.
- [x] Add feature flag to enable/disable remote logging.

### Acceptance Checks

- [ ] Load test: queue remains bounded under transport outage.
- [ ] Recovery test: logger recovers and flushes after endpoint returns.
- [ ] No UX regression: user actions remain responsive during sink outage.

### Evidence

- PR links:
- Test output: proxy routes and transport wiring added; outage/load checks pending.

---

## WS6 — Dashboards and Operational Checks

### Deliverables

- [ ] Create gofr-seq saved query: user-impact failures by operation/error_code.
- [ ] Create latency dashboard (p50/p95 duration by operation).
- [ ] Create transport health dashboard (`logging_transport_degraded/recovered`).
- [ ] Create noisy-component dashboard by event volume.

### Acceptance Checks

- [ ] Dashboard links documented in runbook.
- [ ] On-call can identify top 3 failure causes within 5 minutes.
- [ ] Alert simulation validated for transport degraded condition.

### Evidence

- Dashboard links:
- Alert test output:

---

## WS7 — Hardening and Rollout

### Deliverables

- [ ] Add progressive rollout plan (dev → staging → prod).
- [ ] Define sampling policy (no sampling for errors; controlled sampling for high-volume info).
- [ ] Add kill switch for remote logging transport.
- [ ] Finalize retention and privacy policy alignment.

### Acceptance Checks

- [ ] Staging soak test completed with no memory growth issues.
- [ ] Security/privacy sign-off complete.
- [ ] Production go-live checklist complete.

### Evidence

- Rollout notes:
- Sign-off links:

---

## Milestones

| Milestone | Scope | Exit Criteria | Status |
|---|---|---|---|
| M1 | WS1 + WS2 | Logger and redaction foundations merged and tested | [x] |
| M2 | WS3 + WS4 | API + page instrumentation complete for GOFR-DIG flows | [~] |
| M3 | WS5 | gofr-seq transport operational in dev/staging | [~] |
| M4 | WS6 + WS7 | Dashboards, alerts, and prod hardening complete | [ ] |

---

## Verification Commands (Execution Phase)

Use these checks during implementation:

- Type safety:
  - `npx tsc --noEmit`
- Search for runtime console usage:
  - `grep -RIn "console\.log\|console\.warn\|console\.error" src`
- Confirm logger adoption points:
  - `grep -RIn "from '../services/logging\|from \"../services/logging" src`
- Validate proxy entries:
  - `grep -RIn "gofr-seq\|seq" vite.config.ts docker/nginx.conf`

---

## Weekly Progress Update Template

### Week of: ________

- Overall status: [ ] Green [ ] Amber [ ] Red

- Completed this week
  -

- In progress
  -

- Blockers
  -

- Next week
  -

- Risks/decisions needed
  -

---

## Definition of Done

- [ ] All milestone exit criteria are complete.
- [ ] Logging guide and implementation plan are synchronized.
- [ ] Runtime paths emit structured, redacted, correlated events.
- [ ] gofr-seq dashboards and degraded-mode checks are operational.
- [ ] Production rollout is complete with rollback path documented.

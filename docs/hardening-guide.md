# GOFR Console Hardening Guide

This guide focuses on making UI behavior resilient to server-side issues and improving error clarity. The objective is that errors explain the *cause* and *recovery*, not just the side effect.

## Step 1: Standardize API Errors (Implemented)

**Goal:** Always include service/tool context, status code, and recovery guidance.

- Introduce a shared `ApiError` type in `src/services/api/errors.ts`.
- Wrap MCP failures in `ApiError` inside `McpClient.callTool()`.
- Ensure errors include `service`, `tool`, `statusCode`, and `recovery` hints.

## Step 2: Consistent Parsing & Messaging (Implemented)

**Goal:** Avoid ambiguous “Failed to parse” errors.

- Centralize MCP response parsing to surface server `status`, `message`, and `error_code`.
- Convert parse failures into `ApiError` with guidance (e.g., “Check MCP logs”).

## Step 3: UI-Friendly Error Surfaces (Implemented)

**Goal:** Make error messages actionable.

- When showing errors, prefer messages that include the *tool* and *recovery* steps.
- Example format: `GOFR-IQ / get_client_profile failed: token expired. Recovery: re-authenticate.`

## Step 4: Retry & Timeout Strategy (Implemented)

**Goal:** Fail fast with the right recovery action.

- Retry session-init failures once; avoid infinite retries.
- For 401/403, suggest token refresh and stop auto-retry.
- For 5xx, suggest checking MCP container health.

---

## Implementation Checklist

- [x] Step 1: Standardized `ApiError`
- [x] Step 2: Centralized parsing helpers
- [x] Step 3: UI error messaging format
- [x] Step 4: Retry/timeout policy

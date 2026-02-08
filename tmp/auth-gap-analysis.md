# Auth Gap Analysis — gofr-dig Console vs server-auth.md

Comparison of what `server-auth.md` requires vs what the console currently implements.

---

## ✅ Already Aligned

| Requirement | Status | Where |
|---|---|---|
| **auth_tokens in MCP tool args** | ✅ Done | All `dig*` API methods pass `auth_tokens: [authToken]` when a token is selected |
| **Authorization Bearer header on callTool HTTP** | ✅ Done | `McpClient.callTool()` sets `Authorization: Bearer` header when `authToken` is provided |
| **Token storage** | ✅ Done | Named tokens stored in `ui-config.json`, accessible via `configStore` / `useConfig()` hook |
| **Anonymous mode** | ✅ Done | `requireToken()` returns `undefined` when no token selected; API methods conditionally omit `auth_tokens` |
| **HTTP 401/403 detection** | ✅ Done | `McpClient.callTool()` throws `ApiError` with `statusCode` for 401/403 |
| **MCP tool error_code detection** | ✅ Done | `parseToolText()` checks `parsed.status === 'error'` and stores `parsed.error_code` in `ApiError.code` |
| **ping is public** | ✅ Done | `GofrDigHealthCheck.tsx` doesn't use a token selector; `digPing` accepts optional token but health page doesn't pass one |

---

## ⚠️ Gaps to Address

### Gap 1: No differentiation of AUTH_ERROR vs PERMISSION_DENIED in UI

**Spec says:**

- `AUTH_ERROR` (401) → clear token, prompt re-auth
- `PERMISSION_DENIED` (403) → show "Access Denied", do NOT prompt re-login — offer group switch

**Current behavior:**

- Both 401 and 403 throw the same `ApiError` with message `"Unauthorized or forbidden"` and the same recovery hint: `"Re-authenticate and verify token permissions."`
- Pages display the raw error string in an `<Alert severity="error">` — no special handling for auth vs permission errors
- No group-switch suggestion

**Fix needed:**

- In `McpClient.callTool()`: split 401 and 403 into separate `ApiError` throws with distinct `code` values (e.g., `'AUTH_ERROR'` vs `'PERMISSION_DENIED'`)
- In `parseToolText()`: detect `error_code === 'AUTH_ERROR'` and `error_code === 'PERMISSION_DENIED'` from MCP tool responses and propagate the specific code
- In UI error display: check `ApiError.code` and show appropriate message (re-auth vs access denied / group mismatch)

**Effort:** Small — mostly error message differentiation, no new screens needed.

---

### Gap 2: No MCP tool-level `success: false` check for auth errors

**Spec says:** MCP tool calls return auth errors as:

```json
{
  "success": false,
  "error_code": "AUTH_ERROR",
  "error": "Token expired",
  "recovery": "Re-authenticate and retry with a valid token."
}
```

**Current behavior:**

- `parseToolText()` checks `parsed.status === 'error'` — but the spec says the field is `success: false`, not `status: 'error'`
- If the server uses `success: false` instead of `status: 'error'`, auth errors from tools would slip through as valid data

**Fix needed:**

- Add `if (parsed.success === false)` check to `parseToolText()` alongside the existing `parsed.status === 'error'` check
- Use `parsed.error_code` and `parsed.error || parsed.message` for the error details
- Propagate `parsed.recovery` into the ApiError recovery field

**Effort:** Tiny — 5-line addition to `parseToolText()`.

---

### Gap 3: `digPing` still accepts and sends auth_tokens

**Spec says:** `ping` is public, `auth_tokens` accepted by every tool **except** ping.

**Current behavior:** `digPing()` conditionally injects `auth_tokens` if a token is provided. The health check page doesn't send one, but the scraper page's `digPing` call could.

**Fix needed:** Minor — remove `auth_tokens` injection from `digPing()`. Not breaking, just unnecessary noise.

**Effort:** Trivial — remove 1 line.

---

### Gap 4: Web REST endpoints not used

**Spec says:** Direct REST endpoints available at port 8072:

- `GET /sessions/{id}/info`
- `GET /sessions/{id}/chunks/{index}`
- `GET /sessions/{id}/urls`

All require `Authorization: Bearer` header.

**Current behavior:** All session operations go through MCP tool calls (port 8070). The REST endpoints on port 8072 are not used. Earlier testing confirmed port 8072 was not responding.

**Impact:** None for now — MCP tool calls with `auth_tokens` achieve the same result. REST endpoints would be useful later for direct chunk downloads (e.g., the Chunk URLs card for N8N).

**Fix needed:** None immediately. When port 8072 becomes available, add REST-based methods as alternatives.

---

### Gap 5: No group display in session list

**Spec says:** Sessions are scoped by group. `list_sessions` returns only sessions matching the token's group (plus public).

**Current behavior:** Session list table shows session_id, URL, chunks, size, created_at. The `group` field is returned by the server (currently `null` for all existing sessions) but not displayed.

**Fix needed:** Add a "Group" column to the sessions table. Show `(public)` when group is null, otherwise show the group name.

**Effort:** Small — add one table column.

---

### Gap 6: No explicit re-auth / token-refresh flow

**Spec says:** On AUTH_ERROR (401), clear stored token and redirect to login.

**Current behavior:** No login/auth flow exists. Tokens are pre-configured in `ui-config.json`. There's no "clear token" or "redirect to login" action.

**Impact:** Low — this is a dev/admin console, not an end-user app. Tokens are managed via config file, not user login.

**Fix needed:** None for current use case. If user-facing auth is added later, this would need a login flow.

---

## Priority Order

| # | Gap | Effort | Impact |
|---|---|---|---|
| 1 | **Gap 2** — Add `success: false` check in parseToolText | Tiny | High — auth errors could be silently swallowed |
| 2 | **Gap 1** — Differentiate AUTH_ERROR vs PERMISSION_DENIED | Small | Medium — better UX for group-scoped access |
| 3 | **Gap 5** — Show group column in session list | Small | Medium — visibility into session ownership |
| 4 | **Gap 3** — Remove auth_tokens from ping | Trivial | Low — cosmetic |
| 5 | **Gap 4** — REST endpoints | None now | Future — when port 8072 is live |
| 6 | **Gap 6** — Re-auth flow | None now | Future — if user login is added |

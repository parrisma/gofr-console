# GOFR-DIG API v2 Migration — Implementation Guide

Date: 2026-02-14

## Summary

The GOFR-DIG MCP API has been updated. This document covers all breaking changes,
new features, and the corresponding UI/service-layer modifications made to the
gofr-console to fully support the new API surface.

---

## Breaking Changes

### 1. Auth parameter renamed: `auth_tokens` → `auth_token`

| Before | After |
|---|---|
| `"auth_tokens": ["<jwt>"]` (array) | `"auth_token": "<jwt>"` (string) |

All gofr-dig MCP tool calls now accept a single `auth_token` string instead of
an array. This change affects every authenticated tool:

- `set_antidetection`
- `get_content`
- `get_structure`
- `get_session_info`
- `get_session_chunk`
- `list_sessions`
- `get_session_urls`
- `get_session`

**`ping`** is explicitly unauthenticated and does not accept any auth parameter.

**Files changed:**
- `src/services/api/index.ts` — all `digXxx` methods updated

> Note: Other MCP services (gofr-iq, gofr-doc, etc.) still use `auth_tokens`
> array. Only gofr-dig changed.

### 2. `respect_robots_txt` parameter removed

robots.txt is now **always enforced** server-side. There is no option to disable it.

| Before | After |
|---|---|
| `respect_robots_txt: true/false` | _(removed — always on)_ |

**Files changed:**
- `src/types/gofrDig.ts` — removed from `AntiDetectionConfig`
- `src/pages/GofrDig.tsx` — removed toggle, replaced with info alert
- `src/services/api/index.ts` — no longer sent

### 3. `max_tokens` → `max_response_chars`

The response size cap has been renamed and reranged.

| Before | After |
|---|---|
| `max_tokens` (1 000 – 1 000 000) | `max_response_chars` (4 000 – 4 000 000, default 400 000) |

This is now explicitly a **character count**, not a token estimate.

**Files changed:**
- `src/types/gofrDig.ts` — renamed field in `AntiDetectionConfig`
- `src/pages/GofrDig.tsx` — updated state, label, range, tooltip
- `src/services/api/index.ts` — passes new field name

### 4. Session mode behavior for `depth > 1`

| Before | After |
|---|---|
| Session mode only at depth 1 | `depth > 1` **forces** session mode |

Multi-page crawls automatically store results in sessions. The UI now
auto-enables session mode when depth > 1 and disables the toggle.

**Files changed:**
- `src/pages/GofrDig.tsx` — toggle auto-checked and disabled when depth > 1;
  chunk_size field enabled when depth > 1 even if manual session toggle is off

### 5. `hello_world` tool removed

The `hello_world` debug tool no longer exists in the API. It was not used in the
console UI code, only referenced in old documentation.

### 6. `get_session_urls` — `as_json` default changed

| Before | After |
|---|---|
| `as_json` defaults to `false` | `as_json` defaults to `true` |

The API service layer no longer sends `as_json: false` by default; it only sends
the parameter when explicitly specified.

**Files changed:**
- `src/services/api/index.ts` — `digGetSessionUrls` no longer forces `as_json: false`

---

## New Features

### 1. `filter_noise` (get_content)

New boolean parameter (default `true`). Removes boilerplate elements (nav, footer,
ads) from extracted content. Keeps only main content.

**UI:** New "Filter noise" toggle in Content Extraction section.

**Files changed:**
- `src/types/gofrDig.ts` — added to `ContentOptions`
- `src/pages/GofrDig.tsx` — new state + toggle with tooltip
- `src/services/api/index.ts` — passed through to MCP call

### 2. `timeout_seconds` (get_content, get_structure)

New numeric parameter (default `60`). Per-URL fetch timeout in seconds.

**UI:** New "Timeout (seconds)" field in both Structure Discovery and Content
Extraction sections.

**Files changed:**
- `src/types/gofrDig.ts` — added to `ContentOptions` and `StructureOptions`
- `src/pages/GofrDig.tsx` — new state + fields for both sections
- `src/services/api/index.ts` — passed through to MCP calls

### 3. `selector` for get_structure

New string parameter. Scopes structural analysis to a CSS selector.

**UI:** New "CSS selector (optional)" field in Structure Discovery section.

**Files changed:**
- `src/types/gofrDig.ts` — added to `StructureOptions`
- `src/pages/GofrDig.tsx` — new state + field with tooltip
- `src/services/api/index.ts` — passed through to MCP call

### 4. `response_type` in ContentResponse

Content responses now include an explicit `response_type` field:
- `"inline"` — content returned directly
- `"session"` — content stored server-side, session_id provided

The UI now checks both `session_id` and `response_type === 'session'` to detect
session responses.

**Files changed:**
- `src/types/gofrDig.ts` — added `ResponseType` and field to `ContentResponse`
- `src/pages/GofrDig.tsx` — updated session detection logic

### 5. Comprehensive error codes

A full error code taxonomy has been added to the type system:

```typescript
export type DigErrorCode =
  | 'INVALID_URL' | 'URL_NOT_FOUND' | 'FETCH_ERROR' | 'TIMEOUT_ERROR'
  | 'CONNECTION_ERROR' | 'ROBOTS_BLOCKED' | 'ACCESS_DENIED' | 'RATE_LIMITED'
  | 'RATE_LIMIT_EXCEEDED' | 'SSRF_BLOCKED' | 'SELECTOR_NOT_FOUND'
  | 'INVALID_SELECTOR' | 'EXTRACTION_ERROR' | 'ENCODING_ERROR'
  | 'INVALID_PROFILE' | 'INVALID_HEADERS' | 'INVALID_RATE_LIMIT'
  | 'MAX_DEPTH_EXCEEDED' | 'MAX_PAGES_EXCEEDED' | 'UNKNOWN_TOOL'
  | 'INVALID_ARGUMENT' | 'INVALID_MAX_RESPONSE_CHARS' | 'AUTH_ERROR'
  | 'PERMISSION_DENIED' | 'SESSION_ERROR' | 'SESSION_NOT_FOUND'
  | 'INVALID_CHUNK_INDEX' | 'CONFIGURATION_ERROR' | 'CONTENT_TOO_LARGE';
```

Standard error shape:
```json
{
  "success": false,
  "error_code": "SOME_CODE",
  "message": "Human-readable message",
  "details": {},
  "recovery_strategy": "How to fix"
}
```

**Files changed:**
- `src/types/gofrDig.ts` — added `DigErrorCode` type and `DigErrorResponse` interface

---

## JWT / Auth Model

### MCP Tool Auth

- Each auth-aware tool accepts an optional `auth_token` (single string).
- Omitting it means public/anonymous access.
- `ping` is unauthenticated — no `auth_token`.
- If token is provided but invalid → `AUTH_ERROR`.
- If no token provided → proceed as public (no error).
- Multiple groups in token → group index `0` is used.

### MCPO / Web Behavior

- MCPO passes `Authorization` header through to MCP.
- Web endpoints accept `Authorization: Bearer <JWT>` header only (no query param).

---

## Security Defaults

### SSRF Protection
All outgoing URL fetches block private/internal targets by default:
- RFC1918 ranges, loopback, link-local, IPv6 equivalents
- Returns `SSRF_BLOCKED` error code

### Inbound Rate Limiting
- `GOFR_DIG_RATE_LIMIT_CALLS` (default 60)
- `GOFR_DIG_RATE_LIMIT_WINDOW` (default 60s)
- Returns `RATE_LIMIT_EXCEEDED` when exceeded

---

## Files Modified (Complete List)

| File | Changes |
|---|---|
| `src/types/gofrDig.ts` | Removed `respect_robots_txt`, renamed `max_tokens` → `max_response_chars`, added `filter_noise`, `timeout_seconds`, `selector` (structure), `ResponseType`, `DigErrorCode`, `DigErrorResponse` |
| `src/services/api/index.ts` | `auth_tokens` → `auth_token` for all dig methods, removed auth from `digPing`, updated `digGetSessionUrls` default, passes new params |
| `src/pages/GofrDig.tsx` | Removed robots toggle, renamed max tokens UI, added filter noise toggle, timeout fields, structure selector, fixed session mode for depth > 1, response_type detection |

---

## API Tool Reference (New)

See `tmp/tools.md` for the complete tool reference including all parameters,
response shapes, and the full error code table.

### Quick Parameter summary

| Tool | Key params |
|---|---|
| `ping` | _(none, unauthenticated)_ |
| `set_antidetection` | `profile`, `custom_headers`, `custom_user_agent`, `rate_limit_delay` (0–60), `max_response_chars` (4K–4M), `auth_token` |
| `get_content` | `url`, `depth` (1–3), `max_pages_per_level` (1–20), `selector`, `include_links`, `include_images`, `include_meta`, `filter_noise`, `session`, `chunk_size`, `timeout_seconds`, `auth_token` |
| `get_structure` | `url`, `selector`, `include_navigation`, `include_internal_links`, `include_external_links`, `include_forms`, `include_outline`, `timeout_seconds`, `auth_token` |
| `get_session_info` | `session_id`, `auth_token` |
| `get_session_chunk` | `session_id`, `chunk_index`, `auth_token` |
| `list_sessions` | `auth_token` |
| `get_session_urls` | `session_id`, `as_json` (default true), `base_url`, `auth_token` |
| `get_session` | `session_id`, `max_bytes` (default 5MB), `auth_token` |

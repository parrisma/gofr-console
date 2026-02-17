# tools.md Delta — Implementation Plan

Reference: tmp/tools.md (authoritative MCP tool spec for gofr-dig)
Compared against: current UI code in src/pages/GofrDig.tsx, src/types/gofrDig.ts, src/services/api/index.ts

---

## Summary of Gaps

Comparing the authoritative tools.md against the current UI, there are 6 changes needed across types, API layer, and UI forms.

---

## 1. get_content — New Parameters

### 1a. parse_results (boolean, default true)

Status: NOT in ContentOptions, NOT on UI form, NOT sent to API.

What it does: When true (default), server runs deterministic news parser on crawl results and returns {feed_meta, stories} with deduplication, classification, quality signals. When false, returns raw crawl output (pages, text, links).

Changes needed:

- types/gofrDig.ts: Add parse_results?: boolean to ContentOptions
- types/gofrDig.ts: Add parsed response types (FeedMeta, Story, ParsedContentResponse or extend ContentResponse with feed_meta/stories fields)
- GofrDig.tsx: Add state, Switch control, include in handleFetchContent options, include in request preview tooltip
- GofrDig.tsx: Add a "Parsed" or "Stories" result tab to display feed_meta and stories when parse_results is true

### 1b. source_profile_name (string, optional)

Status: NOT in ContentOptions, NOT on UI form, NOT sent to API.

What it does: Source profile for the news parser (e.g. "scmp"). Controls site-specific date patterns, section labels, noise markers. Only meaningful when parse_results=true.

Changes needed:

- types/gofrDig.ts: Add source_profile_name?: string to ContentOptions
- GofrDig.tsx: Add state, TextField control (only shown when parse_results=true), include in handleFetchContent options, include in request preview tooltip

### 1c. max_bytes (integer, default 5242880)

Status: NOT in ContentOptions, NOT on UI form, NOT sent to API.

What it does: Max inline response size in bytes (5 MB default). Returns CONTENT_TOO_LARGE error if exceeded.

Changes needed:

- types/gofrDig.ts: Add max_bytes?: number to ContentOptions
- GofrDig.tsx: Add state, number input, include in handleFetchContent options, include in request preview tooltip

---

## 2. get_structure — New field: language

Status: PageStructureResponse already has optional language field? No — check shows it does NOT.

What it does: Server returns the detected page language.

Changes needed:

- types/gofrDig.ts: Add language?: string to PageStructureResponse (already present, no change needed if so)
- GofrDig.tsx: Display language in structure results if returned

---

## 3. ContentResponse — New response shape for parsed mode

When parse_results=true, the response shape changes to include feed_meta and stories instead of raw text/links/pages.

Changes needed:

- types/gofrDig.ts: Define new types:
  - ParsedStory: {title, url, date, section, summary, quality_score, ...}
  - FeedMeta: {source, parser_profile, total_stories, dedup_count, ...}
  - Extend ContentResponse with optional feed_meta?: FeedMeta and stories?: ParsedStory[]
- GofrDig.tsx: New tab "Stories" or "Parsed" showing stories table/list and feed_meta summary

---

## 4. get_session — Missing parameters in API call

Current API: digGetSession(authToken, sessionId, maxBytes?) — has maxBytes but NOT timeout_seconds.

tools.md says get_session also accepts timeout_seconds (default 60).

Changes needed:

- api/index.ts: Add timeout_seconds parameter to digGetSession
- GofrDigSessions.tsx: Consider exposing timeout control for large session retrieval (optional, low priority)

---

## 5. DigErrorCode — Missing error codes

Current DigErrorCode union is missing these from tools.md:

- CHUNK_NOT_FOUND (listed under get_session_chunk errors, currently we have INVALID_CHUNK_INDEX)
- PARSE_ERROR (new, for when parse_results=true fails)

Changes needed:

- types/gofrDig.ts: Add CHUNK_NOT_FOUND and PARSE_ERROR to DigErrorCode union

---

## 6. Request Preview Tooltip — Must include new fields

The info tooltip next to the Fetch Content button must include the new parameters:

- parse_results
- source_profile_name
- max_bytes

Changes needed:

- GofrDig.tsx: Add these three fields to the tooltip JSON object

---

## Implementation Order

Step 1: Types (gofrDig.ts)

- Add parse_results, source_profile_name, max_bytes to ContentOptions
- Add language to PageStructureResponse (if missing)
- Add ParsedStory, FeedMeta types
- Add feed_meta, stories to ContentResponse
- Add CHUNK_NOT_FOUND, PARSE_ERROR to DigErrorCode
- Run tsc

Step 2: API layer (api/index.ts)

- No changes needed for get_content (ContentOptions spreads into params automatically)
- Add timeout_seconds to digGetSession
- Run tsc

Step 3: UI form (GofrDig.tsx)

- Add state: parseResults (boolean, default true), sourceProfileName (string), maxBytes (number, default 5242880)
- Add form controls in Content Extraction section:
  - Switch for parse_results (default on)
  - TextField for source_profile_name (conditional on parse_results=true)
  - Number input for max_bytes
- Pass new fields in handleFetchContent call
- Update request preview tooltip to include new fields
- Run tsc

Step 4: Response display (GofrDig.tsx)

- Add "Parsed" tab (or rename existing tabs) to show feed_meta + stories when present
- Stories rendered as a table or list with title, url, date, section, quality_score
- feed_meta rendered as a summary card above stories
- Existing tabs (Text, Headings, Links, etc.) still work for raw mode
- Run tsc

Step 5: Structure response (GofrDig.tsx)

- Show language field in structure results if returned
- Run tsc

Step 6: Full test

- Run tsc --noEmit
- Run pnpm test:unit
- Manual test with parse_results=true and parse_results=false
- Verify request preview tooltip shows all new fields
- Verify Stories tab renders when parse_results response arrives

---

## Out of Scope

- Server-side changes (tools.md reflects what the server already supports)
- Vault/auth integration (separate workstream)
- SEQ dashboard updates (separate workstream)
- get_session timeout_seconds UI control in GofrDigSessions (low priority, can be added later)

---

## Resolved — Response Schemas

### ParsedStory

| Field | Type | Notes |
|-------|------|-------|
| story_id | string | Deterministic hash: "{profile}:{sha1_prefix}" |
| headline | string | Always present (stories without one are skipped) |
| subheadline | string or null | |
| section | string or null | e.g. "Business", "Opinion" |
| published | string (ISO 8601) or null | Normalised to ISO with timezone offset |
| published_raw | string | The raw date string from the page |
| body_snippet | string or null | First ~4 lines of body, max 400 chars |
| comment_count | integer or null | |
| tags | string[] | e.g. ["opinion"], can be empty |
| content_type | string | "news" or "opinion" |
| author | string or null | Extracted only for opinion pieces |
| language | string or null | From page or meta |
| provenance | object | { root_url, page_url, crawl_depth } |
| seen_on_pages | object[] | [{ page_url, crawl_depth }] — grows during dedup |
| parse_quality | object | See sub-object below |

parse_quality sub-object:

| Field | Type | Notes |
|-------|------|-------|
| parse_confidence | float 0.0–1.0 | 1.0 = all key fields present, normal segmentation |
| missing_fields | string[] | Subset of ["headline","section","subheadline","published"] |
| segmentation_reason | string | "date_anchor+heading_alignment" (normal) or "date_anchor+nearest_preceding_line_fallback" |

Internal fields (_segmentation_reason, _raw_block) should be stripped/ignored in the UI.

### FeedMeta

| Field | Type | Notes |
|-------|------|-------|
| parser_version | string | Semver, currently "0.1.0" |
| source_profile | string | Profile key used, e.g. "scmp" or "generic" |
| source_name | string | Human-readable, e.g. "South China Morning Post" |
| source_root_url | string | The start URL that was crawled |
| crawl_time_utc | string | ISO 8601 UTC timestamp |
| pages_crawled | integer | |
| stories_extracted | integer | After deduplication |
| duplicates_removed | integer | |
| noise_lines_stripped | integer | |
| parse_warnings | integer | Count of entries in top-level warnings array |

### source_profile_name — UI control

Decision: Free text with autocomplete suggestions (MUI Autocomplete with freeSolo).
Known profiles today: "scmp", "generic".
Omitting the field or passing an unknown name silently falls back to "generic".
New profiles are added server-side; the set grows over time so a hardcoded dropdown would go stale.

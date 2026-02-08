# GOFR-DIG Integration Implementation Plan (Functional + UX Focus)

This document refines the integration plan to ensure the GOFR-DIG test page is intuitive, feature-complete, and aligned with the MCP-only workflow described in `docs/gofr-dig-api.md`. The goal is a single page that allows a user to explore all GOFR-DIG capabilities before integrating with automated flows (e.g., n8n), while reusing the existing token model and MCP API layer.

## 1) UX Goals and Success Criteria

**Primary UX goals**

- Make the entire GOFR-DIG tool surface discoverable without reading documentation.
- Keep the workflow linear and forgiving: setup → structure → content → session viewer.
- Provide clear cause-and-recovery error messages (using `ApiError` patterns).

**Success criteria**

- Users can execute all MCP tools required for GOFR-DIG testing (`ping`, `set_antidetection`, `get_structure`, `get_content`, `get_session_info`, `get_session_chunk`) from a single page.
- Users can complete a full “discover → extract → browse” workflow without leaving the page.
- Each control maps 1:1 to a documented MCP parameter, with defaults and guardrails.

## 2) Branding and Visual Consistency (Hard Requirement)

The GOFR-DIG page must honor the same style and branding used for GOFR-IQ.

**Branding requirements**

- Use the same app shell, typography scale, spacing, and color tokens as GOFR-IQ pages.
- Reuse existing layout patterns (cards, panels, headers, tabs) from GOFR-IQ pages.
- Use the same icon set (MUI icons already used in GOFR-IQ) and button styles.
- Keep form field density and label styles consistent with GOFR-IQ forms.

**Implementation guidance**

- Compose from existing common components when possible (e.g., cards, alert banners, section headers).
- Follow the same layout rhythm as GOFR-IQ (page title, description, then panels).
- Avoid custom styling that diverges from the existing theme.

## 3) Single-Page UX Structure (Intuitive Flow)

The page is organized top-to-bottom in the order a user should execute tasks, with the current state visible and reusable:

1. **Health Check & Token**
2. **Anti-Detection Settings**
3. **Structure Discovery**
4. **Content Extraction**
5. **Session Viewer**

Each section is collapsible, includes a “Run” primary action, and shows both the human-readable result and raw JSON for debugging.

## 4) Functional Panels and Capabilities Coverage

### A) Health Check & Token Panel

**Purpose:** Verify MCP access and ensure correct token selection (matching GOFR-IQ health check behavior).

**Inputs**

- Token selector (reusing existing `useConfig()` pattern)

**Actions**

- Health Check → `ping`

**Outputs**

- Status indicator (success/error)
- Raw JSON response
- Error recovery hints

**UX Notes**

- Always visible at top.
- Show the current MCP service target: `gofr-dig`.

### B) Anti-Detection Panel

**Purpose:** Configure scraping behavior for the session.

**Inputs (all MCP fields)**

- Profile dropdown: `stealth`, `balanced`, `none`, `custom`, `browser_tls`
- Robots.txt toggle
- Rate limit delay (0–60 seconds)
- Max tokens (1000–1,000,000)
- Custom headers JSON editor (only when profile=`custom`)
- Custom User-Agent input (only when profile=`custom`)

**Action**

- Apply Settings → `set_antidetection`

**Outputs**

- Display applied settings as confirmation
- Raw JSON response

**UX Notes**

- Use helper text with short descriptions of profiles.
- Validate ranges inline before submission.

### C) Structure Discovery Panel

**Purpose:** Explore site layout and selectors prior to extraction.

**Inputs**

- URL
- Toggles: include navigation, internal links, external links, forms, outline

**Action**

- Analyze Structure → `get_structure`

**Outputs**

- Tree/accordion view for sections and outline
- Lists for navigation, internal/external links, and forms
- Raw JSON response

**UX Notes**

- Provide “Copy selector” affordances for section IDs/classes.
- Highlight empty states (e.g., “No forms found”).

### D) Content Extraction Panel

**Purpose:** Extract text and metadata, or crawl with depth.

**Inputs**

- URL
- Depth (1–3)
- Max pages per level (1–20)
- CSS selector (optional)
- Toggles: include links, images, meta
- Session mode toggle
- Chunk size input (when session mode enabled)

**Actions**

- Fetch Content → `get_content`

**Outputs**

- Tabs: Text, Headings, Links, Images, Meta, Crawl Summary
- If session mode: show session id and total chunks
- Raw JSON response

**UX Notes**

- Warn on high depth/max pages with a “large crawl” badge.
- If session mode returns a session id, auto-populate the Session Viewer panel.

### E) Session Viewer Panel

**Purpose:** Access large results stored in session mode.

**Inputs**

- Session ID
- Chunk index

**Actions**

- Get Info → `get_session_info`
- Get Chunk → `get_session_chunk`

**Outputs**

- Info card: total size, total chunks, created time, source URL
- Chunk preview with copy/download controls
- Raw JSON response

**UX Notes**

- Provide next/prev buttons for chunk navigation.
- Disable chunk fetch unless session id is present.

## 5) MCP-Only Constraint and Token Integration

**Constraint:** The page must operate only via MCP tools (no direct REST).

**Implementation guidance**

- All calls go through `getMcpClient('gofr-dig')` and `callTool`.
- Use existing token selection flow (`useConfig`) for auth tokens.
- Display MCP errors using `ApiError` and show `recovery_strategy` from the response.

## 6) Data and Type Safety

Create `src/types/gofrDig.ts` with strict response types aligned to `docs/gofr-dig-api.md`.

**Minimum required types**

- Anti-detection config/response
- Structure response (sections, navigation, links, forms, outline)
- Content response (single page + crawl summary + session fields)
- Session info and chunk responses

## 7) Error UX and Recovery

All panels should render a unified error banner that includes:

- MCP tool name
- Error code and message
- Recovery guidance (if provided)

Examples:

- `GOFR-DIG / get_content failed: ROBOTS_BLOCKED. Recovery: Use set_antidetection with respect_robots_txt=false.`

## 8) Navigation and Discoverability

- Route: `/gofr-dig`
- Dashboard card should link to `/gofr-dig`.
- ServiceShell should allow custom nav items (or minimal nav) since this is a single-page UX.

## 9) Execution Steps

1. Define GOFR-DIG types (`src/types/gofrDig.ts`).
2. Add `dig*` MCP wrappers to `src/services/api/index.ts`.
3. Implement the single page `src/pages/GofrDig.tsx` with the five panels above.
4. Update `App.tsx` and `Dashboard.tsx` to route and link to GOFR-DIG.
5. Update `ServiceShell` to allow custom nav items.
6. Run `./scripts/code-quality.sh`.

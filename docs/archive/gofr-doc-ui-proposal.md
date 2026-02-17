GOFR-DOC UI Proposal (GOFR Console)
Date: 2026-02-16
Status: Draft

Purpose

- Provide a “live experiment” UI for GOFR-DOC MCP that exercises the end-to-end workflow.
- Enable fast manual validation before building n8n automation that calls the same MCP tools.
- Provide repeatable demos and troubleshooting for auth, discovery, sessions, validation, rendering, and proxy downloads.

Scope

- This UI is a transparent MCP client, not a polished document editor.
- The UX prioritizes reproducible requests/responses (copyable into n8n).

Guiding principles

- Follow existing GOFR Console patterns (as used for GOFR-DIG): ServiceShell + left nav, small focused pages, token selector, consistent request preview + raw JSON viewer.
- Workflow-first: design around the documented GOFR-DOC “Typical Process”, not an unstructured list of tools.
- Always show “what will be sent” and “what came back” for every MCP call.
- Treat inputs as hostile: validate obvious issues (required fields, enums, alias rules, JSON parse errors) but do not block advanced testing (allow raw JSON entry where needed).
- Make identifier lifecycle explicit: session_id (alias/UUID) vs fragment_instance_guid vs proxy_guid.

Information architecture (ServiceShell)

- Base route: /gofr-doc
- Nav items (MVP)
  - Health
  - Discovery
  - Sessions
  - Builder
  - Render & Proxy

Shared UX conventions (all pages)

- Token handling
  - Discovery tools: callable without token; allow optionally selecting a token for tools that accept it.
  - Sessions/Builder/Render: token required; show a clear inline “Auth required” callout when missing.
  - Never show or log token values.

- Request preview (required)
  - Show MCP tool name + arguments that will be sent.
  - Omit/mask auth header values.
  - Copy-to-clipboard for request preview.

- Response viewer (required)
  - Always show raw response JSON.
  - Copy-to-clipboard for raw JSON.

- Error presentation (required)
  - Surface structured error fields first-class when present: error_code, error, recovery_strategy.
  - Keep raw JSON visible for debugging.

- Current context banner (where applicable)
  - Current token (label/name only)
  - Current session_id (alias/UUID)
  - Current template_id (if known)

Page specs

Page 1: Health

Goal

- Verify connectivity to GOFR-DOC MCP via the existing Vite proxy route.

Primary action

- Run Health Check (tool: ping)

Information shown

- Proxy URL: /api/gofr-doc/mcp/
- Upstream MCP URL (derived from config): <http://gofr-doc-mcp>:<mcpPort>/mcp/
- Status chip (healthy/error)
- Raw JSON response

Page 2: Discovery

Goal

- Explore templates/fragments/styles and read help text, without creating a session.

Sections (top-to-bottom)

1) Help

- Action: Get Help (tool: help)
- Output: plain text + raw JSON

1) Templates

- Action: List Templates (tool: list_templates)
- Show results table: template_id, name, description, group
- Input: template_id (select from results)
- Action: Get Template Details (tool: get_template_details)
- Output: globals summary, fragments summary + raw JSON

1) Fragments

- Input: template_id (selected)
- Action: List Template Fragments (tool: list_template_fragments)
- Input: fragment_id (select)
- Action: Get Fragment Details (tool: get_fragment_details)
- Output: parameter schema summary (required/type/default/examples/validation) + raw JSON

1) Styles

- Action: List Styles (tool: list_styles)
- Output: list/table + raw JSON

Page 3: Sessions

Goal

- Exercise session lifecycle and provide a “session list and review” experience (similar to GOFR-DIG).

Sections

1) Create session

- Inputs: template_id, alias
- Alias rules helper (validate client-side): 3–64 chars, letters/numbers/hyphen/underscore
- Action: Create Document Session (tool: create_document_session)
- Output: session_id, alias, template_id, timestamps + raw JSON
- Behavior: set created session as “current session” for Builder/Render.

1) List active sessions

- Action: List Active Sessions (tool: list_active_sessions)
- Results table: alias, session_id, template_id, fragment_count, has_global_parameters, group, updated_at
- Row action: “Use this session” updates current session context.

1) Session status

- Input: session_id (default to current)
- Action: Get Session Status (tool: get_session_status)
- Output: is_ready_to_render, has_global_parameters, fragment_count, timestamps + raw JSON

1) Abort session (destructive)

- Input: session_id
- Confirmation: require typing the alias/UUID before enabling the action
- Action: Abort Document Session (tool: abort_document_session)
- Output: confirmation + raw JSON

Page 4: Builder

Goal

- Build a document session in a workflow-aligned way that is compatible with future n8n automation steps.

Shared context

- Current session banner with quick switch.
- Template context display (if known).

Sections

1) Validate parameters (pre-flight)

- Inputs: template_id, parameter_type (global|fragment), fragment_id (if fragment), parameters (JSON)
- Action: Validate (tool: validate_parameters)
- Output: is_valid, errors list + raw JSON

1) Global parameters

- Input: parameters (JSON)
- Action: Set Global Parameters (tool: set_global_parameters)
- Output: confirmation/updated state + raw JSON

1) Add content fragment

- Inputs: fragment_id, parameters (JSON), position (end/start/before:<guid>/after:<guid>)
- Action: Add Fragment (tool: add_fragment)
- Output: fragment_instance_guid prominently + raw JSON

1) Add image fragment

- Inputs: image_url, title, alt_text, alignment, require_https, position
- Inputs (size): width OR height (enforce exactly one, or neither)
- Action: Add Image (tool: add_image_fragment)
- Output: fragment_instance_guid prominently + raw JSON

1) List fragments (review)

- Action: List Session Fragments (tool: list_session_fragments)
- Results table in display order: fragment_instance_guid, fragment_id/type, created_at, key parameters (collapsed)
- Row actions: Copy GUID, Remove

1) Remove fragment

- Input: fragment_instance_guid (prefill from row action)
- Action: Remove (tool: remove_fragment)
- Output: confirmation + raw JSON

Page 5: Render & Proxy

Goal

- Render to html/md/pdf and test proxy-mode download behavior.

Sections

1) Render

- Inputs: session_id, format (html|md|pdf), style_id, proxy (toggle)
- Action: Render Document (tool: get_document)
- Output: always show raw JSON (including rendered_at)

Output behavior by format

- html: safe preview (sandboxed iframe) + “view raw HTML” toggle
- md: markdown text viewer + copy
- pdf: embedded preview using pdf.js (minimum viable) + download fallback (base64 -> Blob); show size/byte length

1) Proxy mode

- When proxy=true, show proxy_guid and download_url prominently.
- Guidance panel: proxy downloads require Authorization header (Bearer token) and use proxy_guid, not session_id.

1) Proxy download test

- Inputs: proxy_guid, token (selected)
- Action: Fetch Proxy Content (HTTP GET via console proxy route)
- Output: status code, content-type, size; provide download/save action.

Identifier lifecycle (must be explicit in UI)

- session_id
  - May be an alias or UUID; all session/builder/render tools accept either.
- fragment_instance_guid
  - Returned from add_fragment/add_image_fragment; required for remove and for precise positioning.
- proxy_guid
  - Returned only when get_document is called with proxy=true; used for proxy download.

Telemetry/logging

- Use project logger patterns (same as GOFR-DIG): ui_page_view on mount; ui_form_submitted per tool call with operation name, duration_ms, result.
- Never log tokens or document content; log tool name, session identifiers (where safe), and counts/sizes.

Non-goals

- Not a WYSIWYG editor.
- Not hiding MCP complexity; the UI should remain transparent and testable.
- Not building n8n flows; only enabling manual exploration that informs automation.

Acceptance criteria

- A user can complete the full workflow using only the UI:
  - ping -> discovery -> create session -> set globals -> add fragments/images -> list/remove -> validate -> render -> proxy download.
- Every tool call is reproducible in n8n by copy/pasting the request preview JSON.
- Session and GUID lifecycle is clear enough to avoid common confusion (session_id vs fragment_instance_guid vs proxy_guid).

Tool surface summary (reference)

- No auth required: ping, help, list_templates, list_styles
- Optional auth: get_template_details, list_template_fragments, get_fragment_details
- Auth required: create_document_session, list_active_sessions, get_session_status, abort_document_session, validate_parameters, set_global_parameters, add_fragment, add_image_fragment, list_session_fragments, remove_fragment, get_document

Error response shape (when failure)

- success: false
- error_code: string
- error: human-readable message
- recovery_strategy: actionable guidance text

Implementation outline (MVP)

- Add routes + ServiceShell nav for /gofr-doc pages.
- Add ephemeral in-memory context store (current token label, current session_id, current template_id, last style_id).
- Add GOFR-DOC types and API wrapper methods (following existing MCP client patterns).
- Implement pages in the order: Health -> Discovery -> Sessions -> Builder -> Render & Proxy.
- Add pdf.js viewer component for minimal embedded PDF preview.

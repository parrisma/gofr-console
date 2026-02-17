GOFR-DOC UI (Console) — Step-by-step Implementation Plan (Hardened)
Date: 2026-02-16
Status: Draft for review

Goal

Implement the GOFR-DOC MCP “live experiment” UI described in docs/gofr-doc-ui-proposal.md, using existing GOFR Console patterns, with robust input handling and graceful recovery from server-side failures.

Non-goals

- Do not build a WYSIWYG editor.
- Do not add persistence beyond in-memory UI state (unless explicitly required later).
- Do not change the design system or introduce new UI frameworks.

Pre-flight validations (must do before coding)

1) Confirm service identity and proxy wiring

- Confirm the MCP service key/name used by the console is gofr-doc.
- Confirm Vite proxy route exists/will exist: /api/gofr-doc/mcp/.
- Confirm upstream container hostname and port are configured via existing config (useConfig/configStore patterns).

Completion checks

- The Health page displays both proxy URL and upstream URL without hardcoding localhost.
- A manual curl to /api/gofr-doc/mcp/ reaches the service (or fails with a clear upstream error).

1) Confirm tool list and response/error shapes

- Confirm the tool names and required args match the proposal:
  - ping, help
  - list_templates, get_template_details
  - list_template_fragments, get_fragment_details
  - list_styles
  - create_document_session, list_active_sessions, get_session_status, abort_document_session
  - validate_parameters, set_global_parameters
  - add_fragment, add_image_fragment, list_session_fragments, remove_fragment
  - get_document
- Confirm tool-level errors use one (or more) of the following shapes:
  - status: "error" + error_code/message
  - success: false + error_code/error/recovery_strategy
- Confirm where recovery guidance lives (recovery vs recovery_strategy).

Completion checks

- There is a single reference mapping table in the GOFR-DOC types file documenting the minimally required fields used by UI.
- The UI can display server error_code and recovery guidance (not just a generic “failed”).

1) Confirm how auth is passed

- Confirm whether GOFR-DOC expects:
  - Authorization: Bearer <token> header, OR
  - auth_token argument in the tool arguments, OR
  - both.

Completion checks

- One consistent approach is implemented across all GOFR-DOC API calls.
- Tokens never appear in request preview, logs, or error messages.

Implementation steps

Step 1 — Harden MCP parsing for tool-level failures (shared foundation)

Intent

Ensure the UI can reliably detect “server said no” outcomes even when the HTTP call succeeded, and present actionable messages.

Work

- Update the shared MCP parsing logic (src/services/api/index.ts parseToolText) to treat tool responses as errors when either:
  - parsed.status === "error", OR
  - parsed.success === false.
- When raising ApiError, prefer:
  - code: parsed.error_code (when present)
  - message: parsed.error OR parsed.message OR a safe fallback
  - recovery: parsed.recovery_strategy OR parsed.recovery OR defaultRecoveryHint()
- Preserve existing “server error leaked as plain text” detection behavior.

Completion checks

- A unit test proves success:false becomes an ApiError (with code + recovery when provided).
- A unit test proves non-JSON tool output becomes an ApiError and includes a short snippet only.

Step 2 — Add GOFR-DOC types (minimal, permissive)

Work

- Add src/types/gofrDoc.ts with:
  - Template summary, template details, fragment list/details, style list.
  - Session lifecycle responses (create/list/status/abort).
  - Builder responses (validate, set globals, add/remove fragment, list fragments).
  - Render response union (html/md/pdf) and proxy fields.
- Keep types permissive (optional fields) where the server may evolve.

Completion checks

- Type-check passes with no unused types.
- Each UI page can import types without circular dependencies.

Step 3 — Add GOFR-DOC API wrappers (single responsibility, consistent errors)

Work

- Extend src/services/api/index.ts with an api.doc* surface (naming consistent and grouped):
  - docPing, docHelp
  - docListTemplates, docGetTemplateDetails
  - docListTemplateFragments, docGetFragmentDetails
  - docListStyles
  - docCreateDocumentSession, docListActiveSessions, docGetSessionStatus, docAbortDocumentSession
  - docValidateParameters, docSetGlobalParameters
  - docAddFragment, docAddImageFragment, docListSessionFragments, docRemoveFragment
  - docGetDocument
- Ensure every wrapper:
  - Accepts authToken as undefined where allowed.
  - Produces ApiError with service/tool context and recovery guidance.
  - Does not log raw arguments (relies on summarizeArgs filtering).

Completion checks

- Each wrapper is exercised by at least one page action.
- Failures return user-visible, tool-specific errors (not generic “fetch failed”).

Step 4 — Add GOFR-DOC routes and ServiceShell nav

Work

- Add new pages under src/pages:
  - GofrDocHealthCheck
  - GofrDocDiscovery
  - GofrDocSessions
  - GofrDocBuilder
  - GofrDocRenderProxy
- Update src/App.tsx routes:
  - /gofr-doc -> /gofr-doc/sessions (landing)
  - /gofr-doc/health
  - /gofr-doc/discovery
  - /gofr-doc/sessions
  - /gofr-doc/builder
  - /gofr-doc/render
- Provide a GOFR-DOC navItems list in each ServiceShell route (pattern used by GOFR-DIG).
- Update src/pages/Dashboard.tsx to link GOFR-DOC card to /gofr-doc.

Completion checks

- Navigation works and highlights the active icon.
- GlobalErrorBoundary catches render failures and logs ui_unhandled_error.

Step 5 — Add ephemeral GOFR-DOC UI context store (no persistence)

Work

- Add a small in-memory store module to share:
  - selected token index (or token label)
  - current session_id
  - current template_id (optional)
  - last style_id (optional)
- Provide a hook that pages use for consistent read/write.
- Reset on full reload by design.

Completion checks

- Creating a session in Sessions makes Builder/Render default to that session_id.
- Reload clears context and does not break pages.

Step 6 — Build shared UI primitives for GOFR-DOC pages (reduce duplication)

Work

- Implement a shared “Request/Response” panel pattern for GOFR-DOC pages:
  - Request preview: tool name + arguments (token omitted/masked).
  - Response: raw JSON viewer.
  - Copy-to-clipboard controls.
- Implement a shared “ToolError” display:
  - Extract ApiError fields (service/tool/statusCode/code/recovery).
  - Show recovery text prominently when present.
  - Provide “Copy error JSON/details” action.

Hardening requirements

- Ensure request preview is generated from a sanitized arguments object (never include auth_token or Authorization).
- Ensure copied text is bounded (truncate extremely large responses for UI rendering, while still allowing “download/copy raw” where feasible).

Completion checks

- At least two pages reuse the same components for request/response display.
- A simulated ApiError shows tool, status, code, and recovery guidance.

Step 7 — Implement Page: Health

Work

- Mirror GOFR-DIG Health Check behavior:
  - Ping button
  - Status chip
  - Proxy/upstream URL display
  - Raw JSON viewer
- Logging:
  - ui_page_view on mount
  - ui_form_submitted on ping with duration_ms and result

Error behavior

- Show network/timeouts separately from tool-level errors.
- Provide recovery guidance (check MCP service, proxy, token if used).

Completion checks

- Health page works without requiring a token.
- When ping fails, the UI shows an actionable message.

Step 8 — Implement Page: Discovery

Work

- Sections: Help, Templates, Fragments, Styles.
- Data flow:
  - list_templates populates table and template selector.
  - list_template_fragments depends on selected template.
  - detail calls show compact summaries plus raw JSON.
- Optional token selector for detail tools (only if the server supports it).

Hardening requirements

- Guard all actions with required inputs (template_id required before listing fragments).
- On JSON viewer rendering, handle large payloads by collapsing/limiting initial view.

Completion checks

- The user can discover a template and fragment schema without creating a session.
- Server-side errors display error_code + recovery.

Step 9 — Implement Page: Sessions

Work

- Token selector required for this page.
- Create session:
  - Validate alias format client-side.
  - On success, update current session context.
- List sessions:
  - “Use this session” sets context.
- Status:
  - Default to current session.
- Abort:
  - Destructive confirm: type the session alias/UUID to enable.

Hardening requirements

- Clear “Auth required” callout when token missing, and disable actions.
- Treat session_id inputs as hostile: trim, enforce non-empty, show validation errors.

Completion checks

- User can create and switch sessions reliably.
- Abort requires explicit confirmation and provides clear success/failure output.

Step 10 — Implement Page: Builder

Work

- Validate parameters:
  - Requires template_id.
  - Fragment validation requires fragment_id.
  - JSON parse errors are caught client-side with clear guidance.
- Set globals:
  - Requires current session_id.
  - JSON editor for parameters.
- Add fragment and add image fragment:
  - Enforce width XOR height (or neither) for images.
  - Position control supports end/start/before/after.
- List fragments:
  - Table with remove + copy guid.
  - Remove action reuses selected guid.

Hardening requirements

- Never trust server ordering; display fragments in the order returned, and label clearly.
- Avoid UI dead-ends: after add/remove, refresh list (or clearly prompt user to refresh).
- Show fragment_instance_guid prominently and make copying easy.

Completion checks

- Full builder workflow works without manual copy/paste mistakes.
- Invalid JSON never gets sent; the UI blocks with a clear error message and recovery.

Step 11 — Implement Page: Render & Proxy

Work

- Render:
  - format selection: html/md/pdf
  - style selection (from list_styles)
  - proxy toggle
- Output handling:
  - HTML: sandboxed iframe preview and raw HTML view.
  - Markdown: text viewer + copy.
  - PDF: embedded preview + download.
- Proxy mode:
  - When enabled, show proxy_guid + download_url.
  - Provide a “Fetch Proxy Content” test that uses the console proxy route.

Hardening requirements

- HTML preview must not use dangerouslySetInnerHTML.
- Iframe sandbox must not allow scripts.
- Guard against oversized payloads:
  - show size estimates where possible
  - fail gracefully if base64 decode fails
- Proxy downloads:
  - handle 401/403 with clear auth guidance
  - handle 404/expired links with recovery steps

Completion checks

- Rendering failures show tool-specific errors and recovery hints.
- Proxy download test shows status code, content-type, and size.

Step 12 — Add pdf.js dependency and minimal viewer component

Work

- Add pdfjs-dist (or equivalent) as a dependency.
- Configure worker path for Vite builds.
- Implement a minimal viewer component:
  - render first page
  - show page count when available
  - show a download button as fallback

Hardening requirements

- No external network fetches for the worker; use bundled asset.
- Viewer must handle invalid PDFs gracefully (error message + raw response still visible).

Completion checks

- A valid PDF renders inline.
- If the PDF is invalid, the UI stays functional and shows a clear error.

Step 13 — Add unit tests for parsing and error surfaces

Work

- Add new Vitest tests under src/services/api/ (no UI rendering required):
  - parseToolText handles status:error
  - parseToolText handles success:false
  - parseToolText maps recovery_strategy/recovery into ApiError
  - detectServerError turns tracebacks into actionable ApiError

Completion checks

- pnpm run test:unit passes.
- Tests assert that error messages do not include tokens.

Step 14 — Validation and acceptance run

Work

- Run code quality gates:
  - ./scripts/code-quality.sh
- Run unit tests:
  - pnpm run test:unit
- Run build:
  - pnpm run build
- Run security scan:
  - ./scripts/security-scan.sh
- Manual acceptance flow:
  - ping -> discovery -> create session -> set globals -> add fragments/images -> list/remove -> validate -> render -> proxy download.

Completion checks

- All scripted checks pass.
- Manual flow yields copyable request previews and raw responses for each step.
- Server-side errors produce actionable UI errors with recovery guidance, without crashing the page.

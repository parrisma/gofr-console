# Proposal: GOFR-PLOT module in GOFR Console (backed by gofr-doc)

## Context

The gofr-doc service now includes “Plot Tools” migrated from gofr-plot:

- list_themes (no auth)
- list_handlers (no auth)
- render_graph (auth_token required; supports proxy GUID)
- get_image (auth_token required)
- list_images (auth_token required)
- add_plot_fragment (auth_token required; embeds a plot into a GOFR-DOC session)

The GOFR Console should expose GOFR-PLOT as a separate logical module in the UI, but the backend calls must go to the gofr-doc MCP service.

## Goals

- Provide a complete end-to-end GOFR-PLOT workflow in the UI.
- Match the established GOFR-DOC UX patterns (cards, tables, RequestPreview, RawResponsePopupIcon, ToolErrorAlert, token selector behavior).
- Preserve gofr-doc plot tool names and parameter contracts.

## Non-goals

- No new plot backend service in the console (no gofr-plot MCP service dependency).
- No new storage or deletion tool in UI beyond what gofr-doc exposes.
- No complex chart editor UI; prioritize safe, copy/paste-friendly inputs.

## Key constraints / UX implications

- Plot tools are stateless except for proxy storage (GUID/alias). There is no “plot session” tool in gofr-doc.
- Some discovery tools are unauthenticated (themes/handlers), but all rendering/storage tools require auth_token.
- Proxy mode produces GUIDs and shifts the workflow from inline preview to retrieval (get_image) and embedding (add_plot_fragment).

## Proposed module structure (mirrors GOFR-DOC paradigm)

Add a new top-level GOFR-PLOT module with pages analogous to GOFR-DOC:

1) GOFR-PLOT Health

- Purpose: verify the backend is reachable and that plot subsystem is usable.
- Pattern: same as GOFR-DOC Health.
- Calls:
  - ping (existing gofr-doc ping)
  - optional: list_handlers (to validate plot tools are registered)

1) GOFR-PLOT Discovery

- Purpose: browse themes and handlers.
- Pattern: GOFR-DOC Discovery (table-based browse + row-click selection).
- Cards:
  - Themes: Browse themes (list_themes) → table (name, description)
  - Handlers: Browse handlers (list_handlers) → table (name, description)
- Row click behavior:
  - Sets “selected theme” and “selected handler/type” into GOFR-PLOT UI state.

1) GOFR-PLOT Sessions (stored plots)

- Purpose: browse stored plot images (proxy outputs) in your group.
- Pattern: GOFR-DOC Sessions “Active sessions” table.
- Cards:
  - Token (required)
  - Stored plots: list_images → table (guid, alias, format, size, created_at)
- Row click behavior:
  - Sets “selected plot identifier” (guid) into GOFR-PLOT UI state.

1) GOFR-PLOT Builder

- Purpose: render a plot and preview/download it.
- Pattern: GOFR-DOC Builder (JSON input + Validate + Set-type action, raw responses always available).
- Cards:
  - Token (required)
  - Render graph
    - Inputs:
      - title (TextField)
      - proxy toggle (default: false)
      - theme dropdown (from state; defaults to selected theme)
      - type dropdown (from state; defaults to selected handler)
      - format dropdown (png/jpg/svg/pdf)
      - Data input: a single JSON editor for the data series, aligned to render_graph contract
        - Minimal required: y1 array (and optional x)
        - Optional: y2–y5, label1–label5, color1–color5
      - Advanced settings: optional JSON editor section (ticks, min/max, alpha, sizes)
    - Actions:
      - Validate JSON (client-side only)
      - Render graph (render_graph)
    - Output behavior:
      - If proxy=false: show inline image preview (img tag using data URI) + Download
      - If proxy=true: show GUID + Download via get_image (and easy “Use this GUID” for embedding)

1) GOFR-PLOT Embed (bridge into GOFR-DOC)

- Purpose: add_plot_fragment into an existing GOFR-DOC session.
- Pattern: GOFR-DOC Builder fragment add section.
- Inputs:
  - session_id (text; reuses GOFR-DOC context strip patterns, but stays inside GOFR-PLOT module)
  - Mode selector:
    - Use existing plot GUID (plot_guid)
    - Inline render + embed (title/y1/x/etc)
  - Optional fragment settings: width, height, alt_text, alignment (dropdown left/center/right), position (dropdown start/end/before/after using session fragment GUIDs if available)
- Actions:
  - Add plot fragment (add_plot_fragment)
- Output:
  - fragment_instance_guid + refresh hint (user can verify in GOFR-DOC Builder)

## UI state management

Create a GOFR-PLOT UI state store analogous to gofrDocUiStore:

- selectedTokenIndex
- selectedTheme
- selectedHandler/type
- lastRenderParamsJson
- lastRenderResult (inline preview data or last proxy guid)
- selectedPlotIdentifier (guid/alias)
- targetDocSessionId (for embedding)

This keeps GOFR-PLOT logically separate while reusing the same token selection pattern across modules.

## API / service routing

Although the module is called GOFR-PLOT, all tool calls must be executed against gofr-doc MCP:

- Use the existing /api/gofr-doc proxy and McpClient session handling.
- Add typed wrappers in the console API layer for the 6 plot tools.

Note on parameter naming:

- gofr-doc plot tools use auth_token (not token). UI should still label it as “Token” and pass it as auth_token in tool calls.

## Error handling and UX

- Use ToolErrorAlert for all failures.
- Always show RawResponsePopupIcon for each tool response.
- For large images or formats the browser can’t preview (pdf), use download-only (consistent with the approach used in GOFR-DOC Render).
- Keep copy/paste-friendly RequestPreview for every tool call.

## Out of scope questions to confirm early

- Should GOFR-PLOT Embedding be the primary workflow (recommended), or optional behind a collapsed section?
- Should inline preview support svg and pdf, or treat non-raster formats as download-only?
- Should alias be exposed prominently (proxy mode) so users can find plots later in list_images?

## Acceptance criteria (high level)

- User can browse themes/handlers, render a graph inline, and download it.
- User can render with proxy=true, see GUID, retrieve it via get_image, and embed into a GOFR-DOC session via add_plot_fragment.
- The module uses the same visual/interaction patterns as GOFR-DOC and never depends on a separate gofr-plot backend.

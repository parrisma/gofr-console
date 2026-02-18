# Implementation plan: GOFR-PLOT module (backed by gofr-doc)

Purpose: implement GOFR-PLOT pages in the console, mirroring GOFR-DOC UI patterns while calling gofr-doc MCP plot tools.

## Status (2026-02-18)

- Implementation is complete through Phase 8.
- Plan change: Phase 8 “Embed” was implemented as a section inside the Builder page (no separate /gofr-plot/embed route), per user choice.
- Remaining: run docker prod image build (Phase 9 last step) if required.

## Phase 0 — Baseline and branch hygiene

- [x] Create/switch to feature/plot branch
- [x] Confirm clean baseline build: pnpm run build
- [x] Confirm lint is clean: pnpm run lint
- [x] Confirm unit tests are green: pnpm run test:unit

## Phase 1 — Types and API wrappers (no UI)

Goal: add typed wrappers for plot tools under the existing gofr-doc MCP client.

- [x] Extend src/types/gofrDoc.ts with plot tool response types:
  - [x] list_themes response
  - [x] list_handlers response
  - [x] render_graph responses (inline ImageContent vs proxy guid)
  - [x] get_image response
  - [x] list_images response
  - [x] add_plot_fragment response
- [x] Extend src/services/api/index.ts with methods that call gofr-doc tools:
  - [x] docPlotListThemes()
  - [x] docPlotListHandlers()
  - [x] docPlotRenderGraph(authToken, params)
  - [x] docPlotGetImage(authToken, identifier)
  - [x] docPlotListImages(authToken)
  - [x] docPlotAddPlotFragment(authToken, params)
- [x] Ensure RequestPreview tooling can show these tool names/args consistently.

Acceptance:

- TypeScript compiles with new types and wrappers.

## Phase 2 — GOFR-PLOT UI state store

Goal: create a lightweight store mirroring gofrDocUiStore.

- [x] Add src/stores/gofrPlotUiStore.ts
  - [x] selectedTokenIndex
  - [x] selectedTheme
  - [x] selectedHandler
  - [x] selectedPlotIdentifier
  - [x] targetDocSessionId
- [x] Add src/hooks/useGofrPlotUi.ts similar to useGofrDocUi.

Acceptance:

- Store works and persists across GOFR-PLOT pages.

## Phase 3 — Routing and navigation

- [x] Add GOFR-PLOT nav items in src/App.tsx:
  - [x] /gofr-plot/health
  - [x] /gofr-plot/discovery
  - [x] /gofr-plot/sessions
  - [x] /gofr-plot/builder
  - [~] /gofr-plot/embed (not created; embed is inside Builder by design)
- [x] Update Dashboard GOFR-PLOT card to route to /gofr-plot/health.
- [x] Update ServiceShell help text for GOFR-PLOT (quick start steps).

Acceptance:

- User can navigate into GOFR-PLOT module from Dashboard.

## Phase 4 — GOFR-PLOT Health page

- [x] Create src/pages/GofrPlotHealthCheck.tsx
- [x] Call gofr-doc ping and show response.
- [x] Call list_handlers to validate plot tools are present.

Acceptance:

- Page loads and tools work.

## Phase 5 — GOFR-PLOT Discovery page

- [x] Create src/pages/GofrPlotDiscovery.tsx
- [x] Add two cards:
  - [x] Themes: list_themes → table; row click sets selected theme
  - [x] Handlers: list_handlers → table; row click sets selected handler/type
- [x] Include raw response popup + request preview.

Acceptance:

- User can pick theme and handler.

## Phase 6 — GOFR-PLOT Sessions (stored plots)

- [x] Create src/pages/GofrPlotSessions.tsx
- [x] Token required.
- [x] list_images → table (guid, alias, format, size, created_at)
- [x] Row click sets selected plot identifier.
- [x] Add “Get image” section:
  - [x] identifier field (defaults from selected row)
  - [x] get_image action
  - [x] preview/download output

Acceptance:

- User can browse stored plots and fetch one.

## Phase 7 — GOFR-PLOT Builder (render_graph)

- [x] Create src/pages/GofrPlotBuilder.tsx
- [x] Token required.
- [x] Add render_graph form:
  - [x] proxy toggle
  - [x] theme/type/format dropdowns
  - [x] JSON editor for data series (x/y1/y2…)
  - [x] Validate JSON (client-side)
  - [x] Render button
- [x] Output:
  - [x] If proxy=false: show inline preview for png/jpg + Download (others download-only)
  - [x] If proxy=true: show guid + “Use for embed” action

Acceptance:

- User can render inline and via proxy.

## Phase 8 — GOFR-PLOT Embed (add_plot_fragment)

- [x] Embed implemented inside Builder page (no separate src/pages/GofrPlotEmbed.tsx).
- [x] Token required.
- [x] Inputs:
  - [x] session_id (doc session)
  - [x] mode: GUID vs inline
  - [x] plot_guid field (pre-filled from builder/sessions)
  - [x] optional: width/height/alt_text/alignment/position
  - [x] position dropdown supports start/end/before/after (via list_session_fragments)
- [x] Action: add_plot_fragment
- [x] Output: fragment_instance_guid

Acceptance:

- User can embed a previously rendered plot into a GOFR-DOC session.

## Phase 9 — Final verification

- [x] pnpm run lint
- [x] pnpm run build
- [x] pnpm run test:unit
- [ ] bash docker/build-prod.sh

Acceptance:

- All checks green and GOFR-PLOT pages usable end-to-end.

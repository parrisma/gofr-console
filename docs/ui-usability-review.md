# GOFR Console — UI Usability Deep Dive (Financial Services)

Date: 2026-02-17
Audience: Financial-services savvy users (sales/trading/research workflows), non-technical; expects equities-research context.
Scope: GOFR Console web UI (Dashboard, Operations, GOFR-IQ, GOFR-DIG, GOFR-DOC).

## Executive summary

GOFR Console is already strong as an “internal operator/workbench UI”: it exposes powerful MCP tool capabilities with clear request/response transparency, consistent error handling on GOFR-DOC, and pragmatic building blocks (token management, port config, session workflows). The main usability gaps are not domain knowledge — they are orientation, flow, and progressive disclosure:

- Orientation: new users don’t know “where to start” or what the correct sequence is for each service.
- Flow: many pages behave like tool consoles rather than guided workflows, which increases cognitive load.
- Consistency: help, errors, and token selection patterns vary across GOFR-IQ / GOFR-DIG / GOFR-DOC.
- Progressive disclosure: raw JSON is useful but should be secondary, not the primary UI surface.

The proposals below focus on making the UI easier for a sales/trader/UX persona to navigate and succeed quickly, while keeping the transparency that power users value.

## What the UI already does well

- Clear separation by service (GOFR-IQ, GOFR-DIG, GOFR-DOC), each with its own left nav.
- GOFR-DOC pages have a coherent tool workflow: Discovery → Sessions → Builder → Render.
- Request preview (i) pattern supports “trust and verify” without forcing users to read JSON.
- GOFR-DOC structured error handling (`ToolErrorAlert`) provides recovery guidance (this is excellent).
- Operations page is comprehensive and consistent for environment + ports + JWT token management.

## Key usability friction points (observed)

1) “Where do I start?” is not answered on the Dashboard.

- Dashboard shows service cards but not the next action (“Create session”, “Ingest doc”, “Scrape URL”, etc.).

1) Token mental model is inconsistent.

- Some pages use native selects, others use MUI Select; some require token, some optional, some look disabled.
- Users can select “a token” but don’t clearly see which groups it grants and where that matters.

1) Results surfaces are uneven.

- GOFR-DOC Discovery has human-readable tables for templates/styles, but many other surfaces still default to JSON.
- Some pages show both “nice view” and raw JSON without a strong hierarchy.

1) Help content exists but is not consistently discoverable.

- GOFR-DOC has authoring guide help (now a (?) popup) and request previews.
- GOFR-IQ and GOFR-DIG rely more on inline copy or tooltips; there’s no consistent “Help” affordance.

1) Error handling is inconsistent across services.

- GOFR-DOC provides a strong error + recovery experience.
- GOFR-IQ and GOFR-DIG often show raw error strings, which is less actionable for non-technical users.

1) Workflow progress is implicit.

- Users often need a “current context” panel (selected token, group, session_id, template_id, style_id) to understand what state they’re in.
- GOFR-DOC partly solves this via shared store, but the UI doesn’t explicitly surface that context.

## Force-ranked proposals (highest impact first)

Ranking criteria: how much it reduces user confusion/time-to-success for a non-technical financial-services user; not engineering effort.

### 1) Add a consistent “Quick Start” panel per service (highest impact)

Problem:

- Users are presented with capabilities, not tasks.

Proposal:

- For each service landing page (or first nav item), show a short “Quick Start” card:
  - What this service is for (1 sentence)
  - The 3–5 step workflow (bullets)
  - The first recommended action (one primary button)

Examples:

- GOFR-DOC: “1) Pick template → 2) Create session → 3) Set globals → 4) Add fragments → 5) Render” + button “Create Session”.
- GOFR-DIG: “1) Enter URL → 2) Apply anti-detection → 3) Analyze structure → 4) Fetch content” + button “Start with URL”.
- GOFR-IQ: “1) Select client → 2) Review portfolio/watchlist → 3) Review news → 4) Update mandate” + button “Open Client 360”.

Benefit:

- Dramatically reduces time-to-first-success and orientation load.

### 2) Standardize token selection + show group context everywhere (very high impact)

Problem:

- Users don’t consistently understand: token ↔ group ↔ what data they can see.

Proposal:

- Create a single reusable TokenSelect component used across all pages.
- Always show selected token name + groups (chips) + short “scope” hint.
- When auth is required, show a consistent warning + disable only the action controls (not the whole card).

Benefit:

- Prevents “AUTH_REQUIRED” confusion and reduces support overhead.

### 3) Standardize error UX across all services using ToolErrorAlert-style recovery (very high impact)

Problem:

- GOFR-DOC errors are actionable; GOFR-IQ/DIG errors can be cryptic.

Proposal:

- Use a unified error display component everywhere.
- Show:
  - What failed (service/tool)
  - What it means in plain English
  - “Try this next” recovery

Benefit:

- The biggest reduction in user frustration after onboarding.

### 4) Progressive disclosure for raw JSON everywhere (high impact)

Problem:

- Raw JSON is valuable but visually dominates, making the UI feel “developer-only”.

Proposal:

- Default to human-readable views (tables, key-value summaries, previews).
- Raw JSON always available behind a consistent (i) “Raw response” popup or an expandable “Raw” panel.

Benefit:

- Makes the UI approachable while preserving power-user transparency.

### 5) Add a persistent “Current context” strip on GOFR-DOC pages (high impact)

Problem:

- Session workflows are stateful, but the UI doesn’t continuously show what’s currently selected.

Proposal:

- A small context strip at top of GOFR-DOC pages:
  - Token name + group
  - template_id
  - session_id
  - style_id
  - Copy buttons for IDs

Benefit:

- Reduces user error (wrong session/style/template) and makes workflows feel safer.

### 6) Improve Dashboard from “status grid” to “task launcher” (medium-high impact)

Problem:

- Dashboard indicates services exist; doesn’t guide to outcomes.

Proposal:

- Add a second line on each card: “Most common next action” (ex: “Create Doc Session”, “Scrape URL”, “Open Client 360”).
- Add one “Getting started” row at top: three big buttons matching main tasks.

Benefit:

- Helps new users and occasional users; reduces wandering.

### 7) Make help discoverable and consistent (medium impact)

Problem:

- Help is scattered (some pages have tooltips, some a Help button, some none).

Proposal:

- Add a consistent “(?) Help” icon in each service AppBar or page header.
- In the popup: quick start steps + links to docs + key pitfalls.

Benefit:

- Reduces reliance on training; makes the product feel “designed”.

### 8) Tighten microcopy for financial-services workflows (medium impact)

Problem:

- Some text is tool-oriented (“callTool”, “MCP”), not task-oriented.

Proposal:

- Adjust labels to align to outcomes:
  - “Render Document” → “Generate Output (HTML/PDF/Markdown)”
  - “List Styles” → “Choose Styling”
  - “Ingest Document” → “Upload Research / Client Note”

Benefit:

- Better fit for sales/trader UX; clearer intent.

### 9) Provide small “Examples” inline for JSON parameter fields (medium impact)

Problem:

- Builder parameter boxes require users to invent JSON.

Proposal:

- Next to each parameters JSON field, add an (i) that shows 1–2 examples for that tool.
- Use the service’s help payload where possible.

Benefit:

- Reduces errors and accelerates learning without hiding the underlying power.

### 10) Consistent table affordances (lower impact but polish)

Problem:

- Some tables are highly interactive (sortable), others are static, headings previously looked like rows.

Proposal:

- Standardize:
  - header styling (already improved)
  - row hover + click semantics
  - empty-state messaging

Benefit:

- Improves perceived quality; reduces “is this clickable?” uncertainty.

## Suggested help / tooltip design system (practical)

Use three consistent icon affordances:

- (i) Request preview: shows the outgoing tool arguments (already implemented)
- (i) Raw response: shows full JSON returned (implemented for templates/styles)
- (?) Help: shows workflow guidance, pitfalls, examples

Rules:

- Hover opens; click pins; click-away closes.
- Never show secrets in previews.
- Keep popups scrollable with max heights.

## Notes specific to financial-services-savvy users

- Users will understand equities research workflows, client mandates, portfolios, benchmarks, horizons, and compliance constraints.
- They typically do NOT want to reason about sessions/UUIDs/JSON schemas.
- The UI should speak in outcomes (“Create a client-ready report”, “Generate PDF”, “Upload note”), while still allowing advanced “tool view” when needed.

## Next steps (if you want implementation)

I can turn the top 3 ranked proposals into a small implementation plan doc (minimal UI changes, no new pages) and then implement them iteratively.

# GOFR Console — UI Usability Implementation Plan (All Suggestions)

Date: 2026-02-17
Based on: docs/ui-usability-review.md

## Decisions confirmed

- Delivery: phased (multiple small, reviewable change sets)
- Scope: no new routes/pages; implement within existing pages and shells
- Progressive disclosure: primarily via pinned hover/click popups (existing (i)/(?) patterns)
- Dependencies: no new dependencies; use existing MUI + current project utilities

## Cross-cutting acceptance criteria (applies to every phase)

- No secrets are rendered in any tooltip/popup (request previews already sanitize; new surfaces must too)
- Token-required actions are disabled unless a token is selected, but users can still read help/guidance
- Human-readable views are primary; raw JSON remains available without cluttering default screens
- All changes preserve existing workflows (no breaking of current routing, API wrapper usage, or stores)

## Definition of done (for the full program)

- Each phase completes its local acceptance checks
- Full code quality checks pass
- Unit tests pass
- Security scan is run at the end of the final phase and any new findings are resolved or triaged

## Progress tracker

Legend: Not started | In progress | Done

Last updated: 2026-02-17

- Phase 0 (Baseline and guardrails): Not started
- Phase 1 (Quick Start panels): Done
  - Phase 1a (GOFR-DOC Sessions Quick Start): Done
   - Phase 1b (GOFR-DIG Scraper Quick Start): Done
   - Phase 1c (GOFR-IQ Client 360 Quick Start): Done
- Phase 2 (Standardized TokenSelect): Done
- Phase 3 (Unified error display): Done
- Phase 4 (Progressive disclosure for raw JSON): In progress
- Phase 5 (GOFR-DOC context strip): Done
- Phase 6 (Dashboard task launcher): Done
- Phase 7 (Consistent help affordance): Not started
- Phase 8 (Microcopy rewrite): Not started
- Phase 9 (Inline examples for JSON fields): Not started
- Phase 10 (Table affordance consistency): Not started

---

## Phase 0 — Baseline and guardrails (prep)

Goal: reduce risk and ensure changes can be safely iterated.

Steps:

1. Add a short internal checklist to the PR description template (or docs) covering: token selection, popups, raw JSON, errors, and navigation.
2. Identify pages that currently use native selects vs MUI selects for tokens and capture the list in this plan (for tracking).
3. Confirm the current help payload shapes for GOFR-DOC and any existing help endpoints for other services.

Checks:

- No user-visible behavior change expected.

---

## Phase 1 — Quick Start panels per service (Suggestion #1)

Goal: give non-technical users a guided starting point per service.

Implementation approach:

- Add a “Quick Start” card at the top of the first practical page for each service (without adding routes):
  - GOFR-IQ: on Client 360 page (or Health), a compact card describing the common “client workflow” and a primary action.
  - GOFR-DIG: on Scraper page, a compact card describing the 4-step scrape flow and a primary action (focus URL field).
  - GOFR-DOC: on Sessions page, a compact card describing Discovery → Sessions → Builder → Render and a primary action.

Steps:

1. Define the exact Quick Start content for each service (one sentence purpose + 3–5 steps).
2. Implement Quick Start cards using existing MUI Card patterns.
3. Use primary button(s) that navigate to the “next step” within existing routes.
4. Add a small “common pitfalls” link/icon for GOFR-DOC that reuses help payload content (where available).

Checks:

- New users can land on a service and immediately see: what it does, how to use it, and the first action.
- No new routes.

---

## Phase 2 — Standardized TokenSelect component + consistent token UX (Suggestion #2)

Goal: eliminate token selection inconsistency and reduce auth errors.

Implementation approach:

- Introduce one shared TokenSelect component and replace page-local token selectors.
- Display token name + group chips consistently.
- Provide consistent messages for:
  - no tokens configured
  - token required but none selected
  - token optional

Steps:

1. Create TokenSelect component (props: required/optional, selected index/value, onChange, tokens list, helper text).
2. Replace token selection UI across GOFR-IQ, GOFR-DIG, GOFR-DOC pages.
3. Ensure disabling rules are consistent:
   - disable only the action controls that require auth
   - keep help/tooltips readable even when token missing
4. Add a small “scope hint” line on pages where group isolation is critical.

Checks:

- Token selector looks and behaves the same across services.
- Token-required actions cannot be executed without a token.
- Users can still read the page’s guidance even if token missing.

---

## Phase 3 — Unified error display across GOFR-IQ and GOFR-DIG (Suggestion #3)

Goal: make errors actionable for non-technical users.

Implementation approach:

- Use the GOFR-DOC ToolErrorAlert pattern as the standard error surface.
- Ensure that non-ApiError failures still display a useful message and “what to try next”.

Steps:

1. Audit how GOFR-IQ and GOFR-DIG currently surface errors (alerts, raw strings).
2. Extend/standardize ToolErrorAlert so it can:
   - accept unknown errors
   - show a short, human explanation
   - show recovery suggestions (generic when not provided)
3. Replace ad-hoc error alerts on GOFR-IQ and GOFR-DIG pages with the unified component.

Checks:

- Errors read as: what failed + why it matters + how to recover.
- No sensitive data shown.

---

## Phase 4 — Progressive disclosure for raw JSON everywhere (Suggestion #4)

Goal: default to human-readable UI, keep raw JSON secondary.

Implementation approach:

- Standardize a single RawResponsePreview popup component (the (i) pattern) that can be reused.
- Apply it to pages where JsonBlock currently dominates.

Steps:

1. Identify “heavy JSON” surfaces per service and rank them by user-facing value.
2. For each surface:
   - keep primary view (table/summary/preview)
   - move raw JsonBlock to (i) popup
3. Ensure large responses remain readable (scrollable, pinned behavior).

Checks:

- Pages feel less “developer-console” by default.
- Raw JSON remains accessible within one click.

---

## Phase 5 — GOFR-DOC context strip (Suggestion #5)

Goal: always show what session/template/style the user is working on.

Implementation approach:

- Add a small context strip at the top of all GOFR-DOC pages (Health/Discovery/Sessions/Builder/Render).
- Source context from existing gofrDocUiStore.

Steps:

1. Define the context fields shown:
   - selected token name/groups
   - template_id
   - session_id
   - style_id
2. Add “copy” affordances for IDs.
3. Make context strip non-intrusive (single row, collapsible on small screens if needed).

Checks:

- User can always confirm “what I’m working on” without switching pages.
- Copying identifiers is quick and safe.

---

## Phase 6 — Dashboard as task launcher (Suggestion #6)

Goal: turn the Dashboard into an outcome-driven launcher.

Implementation approach:

- Keep the existing service cards but add:
  - a “common next action” line
  - a top row “Getting started” section with 2–3 primary actions

Steps:

1. Define the top 3 outcomes to promote (for this audience):
   - Open Client 360 (GOFR-IQ)
   - Scrape URL (GOFR-DIG)
   - Create Doc Session (GOFR-DOC)
2. Add “next action” microcopy to each relevant service card.
3. Ensure card click targets remain consistent and predictable.

Checks:

- A user can get from Dashboard to the right starting workflow in one click.

---

## Phase 7 — Consistent help affordance per service (Suggestion #7)

Goal: make help easy to find, consistently.

Implementation approach:

- Add a (?) Help icon in each service page header (or ServiceShell header area) that opens a pinned popup.
- Contents:
  - quick start steps
  - key pitfalls
  - link pointers to docs within repo

Steps:

1. Define help content per service.
2. Implement a shared HelpPopup component (reuse existing stable tooltip/pin behavior).
3. For GOFR-DOC, incorporate the service help payload where appropriate.

Checks:

- Users can discover “how to use this screen” without leaving it.

---

## Phase 8 — Microcopy rewrite for financial-services outcomes (Suggestion #8)

Goal: reduce tool-centric wording and make labels outcome-oriented.

Implementation approach:

- Do a controlled sweep of labels and helper text.
- Keep technical wording available in raw/tooltips where necessary.

Steps:

1. Identify top 20 labels/buttons that are tool-centric.
2. Propose new wording and review quickly.
3. Implement wording updates consistently (buttons, headings, helperText).

Checks:

- Labels read as outcomes (“Generate output”, “Upload research note”, “Choose styling”).
- No loss of clarity for power users.

---

## Phase 9 — Inline examples for JSON parameter fields (Suggestion #9)

Goal: reduce trial-and-error when users must enter JSON.

Implementation approach:

- For each JSON input textarea on GOFR-DOC Builder (and other JSON-heavy pages), add an (i) popup showing 1–2 examples.
- Prefer examples sourced from service help payload; fall back to curated static examples in UI.

Steps:

1. Inventory all JSON fields and map them to the relevant tool.
2. Define example payloads per tool (global params, fragment params, image fragment, validate).
3. Implement an “Examples” popup per field.

Checks:

- User can complete common tasks without leaving the page or reading external docs.

---

## Phase 10 — Table affordance consistency (Suggestion #10)

Goal: remove ambiguity about whether tables are interactive and improve readability.

Implementation approach:

- Standardize:
  - header styling (already done globally)
  - hover/click behavior
  - empty states

Steps:

1. Inventory interactive tables vs static tables.
2. Ensure clickable rows have clear hover state and microcopy (“Click row to …”).
3. Ensure empty states are explicit and consistent.

Checks:

- Users can correctly infer what is clickable.

---

## Phase sequencing notes

- Phases 1–3 deliver the biggest usability wins early.
- Phases 4–5 reduce day-to-day friction in GOFR-DOC.
- Phases 6–10 polish and scale consistency.

## Final acceptance pass (end of Phase 10)

1. Walkthrough for each service as a non-technical user:
   - GOFR-IQ: open Client 360, pick token, pick client, view news/portfolio, edit profile
   - GOFR-DIG: pick token, paste URL, apply settings, analyze structure, fetch content, inspect sessions
   - GOFR-DOC: discovery (pick template/style), sessions (create), builder (globals/fragments), render (html/pdf)
2. Confirm:
   - help affordance is discoverable everywhere
   - raw JSON is not the default focus but is always available
   - errors always explain recovery
   - token scope is always clear

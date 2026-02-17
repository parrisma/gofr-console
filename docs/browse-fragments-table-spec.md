# Specification: Browse Fragments Table View

## Problem

Browse Fragments currently renders the response as raw JSON via `<JsonBlock>`. Browse Styles renders as an interactive MUI table with clickable rows. The user wants consistent table rendering for both.

## Current State

### Browse Styles (the target pattern)

- MUI `<Table size="small">` with 3 columns: `style_id`, `name`, `description`
- Clickable rows: clicking a row sets `uiState.styleId` in the shared GofrDocUi store
- Selected row is highlighted via `selected` prop
- Hover effect, keyboard navigation (Enter/Space)
- Caption: "Click a row to set style_id (used on Render)."
- Empty state: `<Alert severity="info">No styles found.</Alert>`
- Raw response viewable via `RawResponsePreview` tooltip beside heading

### Browse Fragments (current)

- Raw JSON block: `<JsonBlock data={fragments} copyLabel="Copy fragments" />`
- Below JSON, a native `<select>` dropdown to pick `fragment_id`
- "View fragment details" button fetches details for selected fragment
- No table, no raw response preview on heading

## Proposed Changes

### In GofrDocDiscovery.tsx, Fragments section (lines ~570-610)

1. Add a `RawResponsePreview` tooltip beside the "Fragments" heading (same as Styles heading has)
2. Replace `<JsonBlock data={fragments} .../>` with an MUI `<Table size="small">` matching the Styles pattern:
   - 3 columns: `fragment_id`, `name`, `description`
   - Clickable rows: clicking a row sets the local `fragmentId` state (selects the fragment for detail viewing)
   - Selected row highlighted when `f.fragment_id === fragmentId`
   - Hover effect, keyboard navigation (Enter/Space)
   - Caption: "Click a row to select fragment_id for detail view."
3. Show `<Alert severity="info">No fragments found.</Alert>` when `fragments.fragments` is empty
4. Remove the `<TextField select>` dropdown for fragment selection (replaced by table row clicks)
5. Keep the "View fragment details" button and its behavior unchanged

### Data Shape (no changes needed)

`DocTemplateFragmentSummary` already has `fragment_id`, `name`, `description` -- matches `DocStyleSummary` structure.

### No other files affected

No type changes, no store changes, no API changes needed.

## Assumptions

- Fragment selection remains local state (`fragmentId`) rather than shared store since it is only used within the Discovery page
- The raw JSON view moves to a `RawResponsePreview` icon on the heading (same as Styles), replacing the inline `JsonBlock`

# Implementation Plan: Browse Fragments Table View

## Pre-requisite

- [ ] Run existing tests to confirm green baseline

## Step 1: Update Fragments heading with RawResponsePreview

- [ ] In GofrDocDiscovery.tsx, wrap the "Fragments" `<Typography>` in an inline-flex Box (same pattern as Styles heading)
- [ ] Add `<RawResponsePreview>` beside it, passing `fragments` data

## Step 2: Replace JsonBlock with Table

- [ ] Remove `<JsonBlock data={fragments} copyLabel="Copy fragments" />`
- [ ] Add conditional table rendering block matching the Styles pattern:
  - Table with columns: fragment_id, name, description
  - Clickable rows setting `fragmentId` via `setFragmentId`
  - Selected row highlighted when `f.fragment_id === fragmentId`
  - Hover + keyboard nav (Enter/Space)
  - Caption: "Click a row to select fragment_id for detail view."
  - Empty alert when `fragments.fragments` is empty but response exists

## Step 3: Remove dropdown selector

- [ ] Remove the `<TextField select>` for fragment_id selection (rows in the table replace this)
- [ ] Remove the `<Divider>` between the old JsonBlock and the dropdown

## Step 4: Verify and test

- [ ] Start dev server and visually verify the table renders correctly
- [ ] Verify clicking a row selects it and enables "View fragment details"
- [ ] Run full test suite

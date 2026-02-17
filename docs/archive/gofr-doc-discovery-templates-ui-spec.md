# GOFR-DOC Discovery: Templates List UI Spec

Date: 2026-02-16
Owner: GOFR Console UI
Status: Draft for review

## Problem

In GOFR-DOC Discovery, the “List Templates” action currently shows only raw JSON, which is hard to scan.

## Goal

Render a readable list/table of templates (template_id, name, description, group) immediately after “List Templates”, while still keeping the raw JSON viewer for debugging/copy.

## Non-goals

- Do not change the underlying MCP tool call.
- Do not remove raw JSON output.
- Do not add pagination/filtering/search unless explicitly requested.

## Proposed UX

- After “List Templates” returns, show a compact table (or list) with columns:
  - template_id
  - name
  - description
  - group
- Keep the existing raw JSON block below the table.

## Interaction (Decision Needed)

Option A (recommended)
- Clicking a row sets the template_id input (used by Get Template Details / List Template Fragments).

Option B
- Add an explicit “Use” button per row to set template_id.

Option C
- Display-only (no selection integration).

## Empty/Error States

- If templates list is empty: show a short “No templates returned” message.
- If tool call fails: keep existing ToolErrorAlert behavior.

## Acceptance Criteria

- The templates are readable without inspecting JSON.
- Raw JSON is still available.
- Selecting a template updates template_id (if Option A or B chosen).
- TypeScript + ESLint + unit tests continue to pass.

# Request Preview Hover Popover Spec

Date: 2026-02-16
Owner: GOFR Console UI
Status: Implemented

## Goal

Move all “Request preview” UI (tool name + arguments) out of the normal page flow and into a small info icon (i) hover popover placed to the right of the action button that triggers the request.

This reduces UI clutter while still keeping requests transparent and copyable for debugging and n8n reproduction.

## In Scope

- Replace all inline/always-visible request preview blocks in the UI with an info icon (i) shown next to the relevant action button.
- The popover content shows the same request preview payload currently shown (tool name + sanitized arguments).
- Arguments must remain sanitized (never show auth tokens or Authorization headers).

## Out of Scope

- Changing what fields are included in the preview payload (beyond existing token/authorization redaction).
- Adding new pages or changing page layouts beyond relocating request preview.

## UX Requirements

- Placement: info icon appears immediately to the right of the action button.
- Behavior: hovering the icon shows a small popover with the request preview JSON.
- The popover should not block interaction with the rest of the page and should close when the user moves the pointer away.
- Accessibility: icon should be keyboard-focusable; focus should show the popover; blur should close it.

## Content Requirements

- Must include:
  - tool name
  - arguments object
- Must exclude:
  - any key matching token/authorization (case-insensitive)

## Copy Behavior

Decision: No copy in popover (view-only).

Rationale: request preview is primarily for inspection and to reduce UI clutter; copying can be added later if required.

## Trigger Behavior

Decision: Hover + click.

- Hover shows the popover for desktop usage.
- Click toggles the popover for touch/trackpad compatibility.

## Implementation Notes

- Implement a shared component (e.g. RequestPreviewPopover) that:
  - renders an IconButton with an info icon
  - manages a hover/focus popover anchored to the icon
  - renders the preview JSON in a compact, bounded area
- Update all call sites to:
  - place the info icon in the same row as the action button
  - remove any always-visible request preview blocks

## Acceptance Criteria

- No request previews are always visible in page flow.
- Every action that previously showed a request preview still has an info icon preview.
- Tokens never appear in preview.
- Code quality checks pass (TypeScript + ESLint).

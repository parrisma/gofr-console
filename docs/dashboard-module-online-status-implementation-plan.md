# Implementation plan: Dashboard module online status (ping-gated)

## Step 1: Add API helper

- Add an API method that attempts MCP tool call "ping" for a given service name.
- Return a boolean (reachable or not) and avoid logging secrets.

## Step 2: Update Dashboard state

- Add a per-module status state: unknown/checking/online/offline.
- On Dashboard load, run ping checks in parallel for all modules.

## Step 3: Update Dashboard rendering

- Replace the hard-coded "Online" text with the computed status.
- Use the existing icon component but change color based on status.
- Keep the existing routes and next-action UX.

## Step 4: Validation

- Run: pnpm run lint
- Run: pnpm run build
- Run: pnpm run test:unit

## Acceptance checks

- If a backend is stopped, its card shows Offline.
- If a backend is running, its card shows Online.
- No module shows Online before a ping result is received.

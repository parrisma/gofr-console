# Login Screen Spec

## Purpose

Add a login gate to gofr-console ahead of full Keycloak integration.
Backed by a flat JSON file (no server-side auth). Users select their identity
at launch; their user type and assigned JWT tokens flow into the existing
configStore/token system. The Operations page becomes the token editor,
persisting tokens back into the same file.

## Current State

- No login. App loads straight into Dashboard.
- JWT tokens live in `data/config/ui-config.json` under `tokens[]`.
- `configStore` loads tokens on boot, persists via `PUT /api/config`.
- Operations page manages tokens (add/edit/delete) in that array.
- Every page that needs auth reads tokens from `useConfig().tokens`.
- AppShell/ServiceShell render the top AppBar; neither shows user info.

## What Changes

### 1. Users File

New file: `data/config/users.json`

```
{
  "users": [
    {
      "username": "jdoe",
      "displayName": "John Doe",
      "userType": "sales-trader",
      "password": "demo123"
    },
    {
      "username": "asmith",
      "displayName": "Alice Smith",
      "userType": "portfolio-manager",
      "password": "demo456"
    }
  ],
  "tokens": [
    { "name": "all", "groups": "all", "token": "eyJ..." },
    { "name": "admin", "groups": "admin", "token": "eyJ..." },
    { "name": "apac-sales", "groups": "apac-sales", "token": "eyJ..." }
  ]
}
```

- `username`: unique login identifier.
- `displayName`: shown in the UI header.
- `userType`: role label (free text for now; e.g. "sales-trader",
  "portfolio-manager", "risk-analyst", "admin"). Shown in the header.
- `password`: plaintext (demo only; Keycloak replaces this).
- `tokens[]`: **shared across all users** -- same `JwtToken` shape
  used today. Every authenticated user sees the same token list in
  Operations and in every token-select dropdown. Managed via the
  Operations page, persisted back to this file.

This is the single source of truth. The existing `tokens[]` array in
`ui-config.json` is removed; tokens now live in `users.json` alongside
the user list (but not nested under individual users).

### 2. Login Screen

- Route: `/login`. All other routes redirect here when not authenticated.
- Simple form: username + password fields, "Sign In" button.
- On submit: fetch `users.json` from server, find matching user,
  compare plaintext password. On failure: inline error message.
- On success: store the user object in a new `authStore` (in-memory,
  not persisted to disk). Load the shared `tokens[]` from the same
  file into `configStore` so all existing token-consuming code works
  unchanged.
- No session cookie/JWT needed (SPA, in-memory state).
- Browser refresh => back to login (acceptable for demo).

### 3. Auth Store

New store: `src/stores/authStore.ts`

State:

- `user: { username, displayName, userType } | null`
- `authenticated: boolean`

Actions:

- `login(username, password) -> boolean` -- fetches users.json,
  validates, sets user, loads tokens into configStore.
- `logout()` -- clears user, clears tokens, navigates to /login.

### 4. Header: User Identity

Both `AppShell` and `ServiceShell` AppBars gain a right-aligned section:

```
[GOFR Console]                [J. Doe | Sales Trader | Logout]
```

- Shows `displayName` and humanised `userType`.
- Logout button clears session, returns to login screen.
- Uses a new shared `UserBadge` component consumed by both shells.

### 5. Token Persistence

Tokens are shared, not per-user. They continue to be managed via the
existing Operations page (`/operations` -> JWT Tokens section). The
only change is the backing store: `configStore` reads/writes tokens
from `users.json` instead of `ui-config.json`.

When Operations adds/edits/deletes a token:

1. `configStore` updates in memory (as today).
2. The updated tokens array is written back to the shared `tokens[]`
   section of `users.json` via `PUT /api/users`.

The Operations UI itself is unchanged -- same add/edit/delete dialog,
same `TokenSelect` dropdowns everywhere. Only the persistence target
moves.

The Vite plugin (`vite/ui-config-plugin.ts`) gets a sibling handler
for `/api/users` (GET/PUT). The nginx prod config gets a matching
read-only `location = /api/users` block (same pattern as `/api/config`).

### 6. Route Guard

A `RequireAuth` wrapper component checks `authStore.authenticated`.
If false, redirects to `/login`. Applied to all routes except `/login`.

### 7. Migration Path to Keycloak

- `authStore.login()` is the only function that touches `users.json`.
  When Keycloak lands, swap its implementation to call the Keycloak
  OIDC flow; the rest of the app (header, tokens, route guard) stays.
- `userType` maps to Keycloak roles/groups.
- `tokens[]` move from the file to Vault or Keycloak token exchange.
- `users.json` is deleted.

## Constraints

- Passwords are plaintext. This is demo-only scaffolding.
- No server-side session. Refresh = re-login (acceptable).
- `users.json` is the single source of truth for users and tokens.
- `ui-config.json` no longer holds `tokens[]` (avoids split-brain).
- No new npm dependencies.

## Assumptions

- Small user count (< 20); no pagination needed.
- Dev mode uses Vite plugin for read/write. Prod nginx serves
  read-only; token edits in prod require the dev server or manual
  file edit (same as today for `ui-config.json`).
- The existing `JwtToken` interface (`name`, `groups`, `token`) is
  unchanged.

## Out of Scope

- Password hashing, salting, or encryption (Keycloak replaces this).
- Role-based access control / permission gating per page.
- Multi-tab session sync.
- "Remember me" / persistent sessions.

## Decisions

1. **User types** (fixed set): Sales Trader, Trader, Analyst, Logistics.
2. **Prod token editing**: local file only; no nginx write endpoint.
3. **Seed data**: manually populated by user.
4. **Auto-login in dev**: not needed.

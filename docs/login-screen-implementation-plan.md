# Login Screen Implementation Plan

Implements [login-screen-spec.md](login-screen-spec.md).

## Pre-flight

- Run full test suite (`pnpm -s run test:unit`) -- baseline must be green.

## Steps

### 1. Seed empty users.json

Create `data/config/users.json` with empty arrays so the file exists
and the Vite plugin can serve it. User will populate with real data.

```json
{
  "users": [],
  "tokens": []
}
```

### 2. Vite plugin: /api/users endpoint

Edit `vite/ui-config-plugin.ts`. Add a GET/PUT handler for
`/api/users` that reads/writes `data/config/users.json`, same
pattern as `/api/config`.

### 3. Nginx: /api/users read-only block

Edit `docker/nginx.conf`. Add `location = /api/users` serving
`/data/config/users.json` (GET only, `405` for other methods).
Same pattern as the existing `/api/config` block.

### 4. authStore

Create `src/stores/authStore.ts`.

- `AuthUser` type: `{ username, displayName, userType }`.
- `UserType` union: `'Sales Trader' | 'Trader' | 'Analyst' | 'Logistics'`.
- State: `_user: AuthUser | null`, listeners set.
- `login(username, password)`: fetch `/api/users`, find match,
  set `_user`, load `tokens[]` into `configStore`, return `true`.
  On mismatch return `false`.
- `logout()`: clear `_user`, clear tokens in `configStore`, notify.
- `get authenticated()`, `get user()`, `subscribe()`.
- Export singleton `authStore`.

### 5. useAuth hook

Create `src/hooks/useAuth.ts`. Thin `useSyncExternalStore` wrapper
around `authStore`, same pattern as `useConfig`. Exposes
`user`, `authenticated`, `login`, `logout`.

### 6. Login page

Create `src/pages/Login.tsx`.

- Centered card with GOFR logo, username/password fields, Sign In
  button.
- Calls `authStore.login()`. Shows inline Alert on failure.
- On success, navigates to `/`.
- No AppShell/ServiceShell wrapper (standalone full-page).

### 7. RequireAuth guard

Create `src/components/common/RequireAuth.tsx`.

- Reads `authStore.authenticated`.
- If false, renders `<Navigate to="/login" />`.
- If true, renders `children`.

### 8. UserBadge component

Create `src/components/layout/UserBadge.tsx`.

- Reads `useAuth()`.
- Renders: `displayName | userType | Logout button`.
- Humanises `userType` (title case, already human-readable from the
  fixed set).
- Logout calls `authStore.logout()` then `navigate('/login')`.

### 9. Wire AppShell header

Edit `src/components/layout/AppShell.tsx`.

- Import `UserBadge`.
- Add `<Box sx={{ flex: 1 }} />` spacer + `<UserBadge />` inside
  the Toolbar, right-aligned.

### 10. Wire ServiceShell header

Edit `src/components/layout/ServiceShell.tsx`.

- Same: add `<UserBadge />` right-aligned in the Toolbar.

### 11. Wire routes in App.tsx

Edit `src/App.tsx`.

- Import `Login`, `RequireAuth`.
- Add route: `<Route path="/login" element={<Login />} />`.
- Wrap every existing route's element in `<RequireAuth>`.
- Add catch-all redirect: `<Route path="*" element={<Navigate to="/" />} />`.

### 12. Move token persistence to users.json

Edit `src/stores/configStore.ts`.

- Token save (`save()`) now writes to `/api/users` instead of
  `/api/config`. It fetches the current `users.json`, updates only
  the `tokens[]` key, and PUTs the full object back.
- Token load on login is handled by `authStore.login()` (step 4),
  not by `configStore.load()`.
- Remove `tokens` from `ui-config.json` default config.
- Keep the rest of `configStore` saving to `/api/config` unchanged
  (env, ports, services still go to `ui-config.json`).

### 13. Remove tokens from ui-config.json

Edit `data/config/ui-config.json`: remove the `tokens` key.
Edit `config/ui-config.json` (repo default): remove the `tokens` key.

### 14. Tests

- Run `pnpm -s run test:unit` -- all existing tests must pass.
- Verify lint, typecheck, complexity gates are green.
- Manual smoke test: login, see header badge, navigate pages,
  add/edit/delete token in Operations, logout, re-login and
  confirm tokens persisted.

### 15. Build and deploy

- `./docker/start-prod.sh --build` -- verify prod container healthy.
- Copy `data/config/users.json` into the prod data volume if the
  Dockerfile doesn't already copy it.

## File Summary

| Action | File |
|--------|------|
| Create | `data/config/users.json` |
| Edit   | `vite/ui-config-plugin.ts` |
| Edit   | `docker/nginx.conf` |
| Create | `src/stores/authStore.ts` |
| Create | `src/hooks/useAuth.ts` |
| Create | `src/pages/Login.tsx` |
| Create | `src/components/common/RequireAuth.tsx` |
| Create | `src/components/layout/UserBadge.tsx` |
| Edit   | `src/components/layout/AppShell.tsx` |
| Edit   | `src/components/layout/ServiceShell.tsx` |
| Edit   | `src/App.tsx` |
| Edit   | `src/stores/configStore.ts` |
| Edit   | `data/config/ui-config.json` |
| Edit   | `config/ui-config.json` |

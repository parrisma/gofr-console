# UI Config Hardening -- Implementation Plan

Items A (Zod validation), B (single source of truth), C (separate tokens from config).

## Current State

| Copy | File | Purpose |
|------|------|---------|
| 1 | `data/config/ui-config.json` | SSOT -- tracked in git, volume-mounted at runtime in containers |
| 2 | `config/ui-config.json` | Redundant copy (legacy, should be removed) |
| 3 | `DEFAULT_CONFIG` in `configStore.ts` | Hardcoded JS fallback |
| 4 | `mcpServices` array in `vite.config.ts` | Proxy route generation |

These four copies already diverge:
- `configStore.ts` defaults list vault/chromadb; the JSON lists keycloak/opensearch.
- `InfraServiceConfig` interface declares `ports: { prod: number; dev: number }` but the JSON has freeform keys (`bolt`, `http`, `rest`, `perf`, `https`).
- `JwtToken[]` lives in `UiConfig` but is persisted via `/api/users` (separate file).

Note: `data/config/users.json` is temporary -- it is a placeholder pending integration
with an enterprise auth system (Keycloak). It will be removed when that integration lands.

---

## Scope

| ID | Item | Effort |
|----|------|--------|
| A | Add Zod runtime schema validation on config load | Small |
| B | Single source of truth for service registry | Medium |
| C | Move token state out of UiConfig / configStore | Small |

## Pre-requisites

None. All changes are internal to the console.

---

## Step 1 -- Add Zod dependency

- `pnpm add zod`
- Zod is ~13 KB gzipped, zero runtime deps, widely adopted in React/TS projects.

Verify: `pnpm ls zod`

---

## Step 2 -- Create `src/types/uiConfig.ts` with Zod schemas

Define the canonical schema in one place and derive all TypeScript types from it.

### 2a -- Infra service ports: freeform record

The JSON uses heterogeneous port keys per service (`bolt`, `http`, `rest`, `perf`, `https`).
Model this as `z.record(z.string(), z.number())` rather than the current broken `{ prod: number; dev: number }`.

### 2b -- Schemas

```
ServicePortsSchema     = z.object({ mcp: z.number(), mcpo: z.number(), web: z.number() })
McpServiceSchema       = z.object({ name, displayName, containerHostname, ports: { prod: ServicePortsSchema, dev: ServicePortsSchema } })
InfraServiceSchema     = z.object({ name, displayName, containerHostname, ports: z.record(z.string(), z.number()) })
UiConfigSchema         = z.object({ version: z.string(), environment: z.enum(['prod','dev']), mcpServices: z.array(McpServiceSchema), infraServices: z.array(InfraServiceSchema) })
```

Note: `tokens` is deliberately absent from `UiConfigSchema` (see Step 5).

### 2c -- Derived types

```ts
export type UiConfig = z.infer<typeof UiConfigSchema>;
export type McpServiceConfig = z.infer<typeof McpServiceSchema>;
export type InfraServiceConfig = z.infer<typeof InfraServiceSchema>;
```

### 2d -- Validation helper

```ts
export function parseUiConfig(raw: unknown): UiConfig {
  return UiConfigSchema.parse(raw);   // throws ZodError with details on mismatch
}
```

Verify: unit test that validates the repo `data/config/ui-config.json` against the schema.

---

## Step 3 -- Integrate validation into configStore

### 3a -- Import and use

In `configStore.ts`, replace the raw `as UiConfig` cast:

```ts
// Before
const config: UiConfig = await response.json();

// After
import { parseUiConfig } from '../types/uiConfig';
const raw = await response.json();
const config = parseUiConfig(raw);
```

### 3b -- Error handling

On `ZodError`, log the validation issues to console.error and fall back to `DEFAULT_CONFIG`.
This preserves the current "use defaults on error" behavior but now surfaces *why* the config was rejected.

### 3c -- Remove duplicate interfaces

Delete `ServicePorts`, `McpServiceConfig`, `InfraServiceConfig`, `UiConfig` interfaces
from `configStore.ts`. Re-export them from `src/types/uiConfig.ts`.
Update all imports across the codebase (`useConfig.ts`, `Operations.tsx`, `api/index.ts`).

Verify: `pnpm run build` (zero TS errors) + `pnpm run lint`.

---

## Step 4 -- Single source of truth for service registry (Item B)

### 4a -- Reduce DEFAULT_CONFIG to a minimal fallback

Replace the full hardcoded service arrays with empty arrays:

```ts
const DEFAULT_CONFIG: UiConfig = {
  version: '1.0.0',
  environment: 'prod',
  mcpServices: [],
  infraServices: [],
};
```

The real data always comes from `data/config/ui-config.json`. The fallback only prevents a
crash if the file is completely unreachable (network error during dev startup).

### 4b -- Generate vite.config.ts proxy from config JSON

Replace the hardcoded `mcpServices` array in `vite.config.ts` with a read of the SSOT:

```ts
import fs from 'fs';
import { parseUiConfig } from './src/types/uiConfig';

const rawConfig = JSON.parse(fs.readFileSync('data/config/ui-config.json', 'utf-8'));
const uiConfig = parseUiConfig(rawConfig);

const mcpProxyEntries = uiConfig.mcpServices.map(s => ({
  name: s.name,
  host: s.containerHostname,
  port: s.ports.prod.mcp,
}));
```

The rest of the proxy-building logic stays the same, just iterates `mcpProxyEntries` instead.

This means adding or removing a service requires editing only `data/config/ui-config.json`.

### 4c -- Reconcile infra service list

Update `data/config/ui-config.json` infra section to match reality.
Add any missing entries (vault, chromadb) if they are used by the UI,
remove any that are not (keycloak, opensearch) -- or keep all if the Operations page displays them.
The key is that this file is the single truth; `DEFAULT_CONFIG` no longer duplicates it.

### 4d -- Eliminate `config/ui-config.json` (the redundant copy)

`data/config/ui-config.json` is the SSOT -- it is tracked in git and volume-mounted
in test/prod containers under `/data/config/`. The `config/ui-config.json` file is a
redundant copy that can drift.

Changes:

1. **Delete `config/ui-config.json`.**
   ```
   git rm config/ui-config.json
   ```
   If the `config/` directory has no other files after this, remove it entirely.

2. **Vite plugin (`vite/ui-config-plugin.ts`)** -- The plugin currently has a
   fallback chain: prefer `data/config/ui-config.json`, fall back to
   `config/ui-config.json`. Simplify: always read from `data/config/ui-config.json`.
   Remove the fallback path and the `fs.existsSync` check.

3. **Dockerfile.prod** -- Currently has `COPY config/ui-config.json /data/config/`.
   Change to `COPY data/config/ui-config.json /data/config/ui-config.json`.

4. **`start-prod.sh`** -- The seed step extracts config from the built image
   (`docker cp ... /data/config/ui-config.json`). This still works because the
   Dockerfile copies the SSOT into the image at build time. No change needed.

This ensures one committed copy (`data/config/ui-config.json`), zero drift.

Verify: `pnpm run dev` starts, proxy routing works, Operations page shows services correctly.

---

## Step 5 -- Separate token state from config (Item C)

### 5a -- Remove tokens from UiConfig

- Remove `tokens: JwtToken[]` from `UiConfigSchema`.
- Remove `tokens` field from `DEFAULT_CONFIG`.
- Remove `saveTokens()`, `saveTokensImmediate()`, `addToken()`, `updateToken()`,
  `deleteToken()`, `setTokens()`, `get tokens()` from `ConfigStore` class.

### 5b -- Create `src/stores/tokenStore.ts`

Move token CRUD into a dedicated store with the same `useSyncExternalStore` pattern:

```ts
class TokenStore {
  private _tokens: JwtToken[] = [];
  private _listeners: Set<() => void> = new Set();

  get tokens(): JwtToken[] { ... }
  setTokens(tokens: JwtToken[]): void { ... }
  addToken(token: JwtToken): void { ... }
  updateToken(index: number, token: JwtToken): void { ... }
  deleteToken(index: number): void { ... }

  // Persist to /api/users
  private save(): void { ... }
  subscribe(listener: () => void): () => void { ... }
}
export const tokenStore = new TokenStore();
```

### 5c -- Update consumers

| File | Change |
|------|--------|
| `authStore.ts` | `import { tokenStore }` instead of `configStore.setTokens(...)` |
| `useConfig.ts` | Remove token-related hooks; move to a new `useTokens.ts` hook |
| `Operations.tsx` | Import from `useTokens` instead of `useConfig` |
| `api/index.ts` | `tokenStore.tokens` instead of `configStore.tokens` |

### 5d -- Keep JwtToken type in `src/types/uiConfig.ts`

The type definition stays shared; only the *storage location* moves.

Verify: Login flow works (tokens load from users.json). Operations page token CRUD works.
`pnpm run build` clean.

---

## Step 6 -- Tests

### 6a -- Schema validation test

Add `tests/code_quality/test_ui_config_schema.test.ts`:
- Loads `data/config/ui-config.json` (the SSOT), parses with `parseUiConfig`, asserts success.
- Asserts failure on deliberately broken payloads (missing required fields, wrong types).

### 6b -- Run existing suite

```
pnpm run test:code-quality
pnpm run build
pnpm run lint
```

---

## Step 7 -- Final verification

1. `pnpm run dev` -- Vite starts, proxy config generated from JSON.
2. Operations page -- services display, environment toggle works, port editing works.
3. Login -- tokens load, token CRUD on Operations page works.
4. `pnpm run build` -- production build clean.
5. `./scripts/code-quality.sh` -- lint clean.

---

## Files changed (summary)

| File | Action |
|------|--------|
| `package.json` | Add `zod` dependency |
| `src/types/uiConfig.ts` | NEW -- Zod schemas, derived types, `parseUiConfig()` |
| `src/stores/configStore.ts` | Remove duplicate interfaces, remove token logic, use `parseUiConfig()` |
| `src/stores/tokenStore.ts` | NEW -- Token CRUD store |
| `src/hooks/useConfig.ts` | Remove token hooks |
| `src/hooks/useTokens.ts` | NEW -- Token hooks |
| `src/stores/authStore.ts` | Use `tokenStore` instead of `configStore` for tokens |
| `src/pages/Operations.tsx` | Import tokens from `useTokens` |
| `src/services/api/index.ts` | Use `tokenStore.tokens` |
| `vite.config.ts` | Read service list from `data/config/ui-config.json` instead of hardcoded array |
| `vite/ui-config-plugin.ts` | Always read from `data/config/ui-config.json` (SSOT); remove fallback |
| `config/ui-config.json` | `git rm` (delete redundant copy) |
| `docker/Dockerfile.prod` | `COPY data/config/ui-config.json` instead of `config/ui-config.json` |
| `data/config/ui-config.json` | Reconcile infra services to match actual usage (SSOT) |
| `tests/code_quality/test_ui_config_schema.test.ts` | NEW -- Schema validation tests |

## Not in scope

- Config version migration (future follow-up).
- Hiding edit UI in prod (future follow-up).
- Env-var overrides at container startup (future follow-up).

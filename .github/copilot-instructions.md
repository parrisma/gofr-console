# Copilot Instructions (GOFR Console)

## Security First
- Assume hostile inputs; validate and sanitize all user-controlled data.
- Avoid `eval`, `Function`, dynamic `require`, or insecure deserialization.
- Prefer safe APIs (`fs/promises`, `path`, `URL`) and avoid shelling out.
- Do not log secrets; redact tokens, keys, and PII.

## Dependency & CVE Hygiene
- Minimize dependencies; prefer built-ins and well‑maintained packages.
- When adding deps, check for active maintenance and known CVEs.
- Use pinned versions where feasible and avoid abandoned packages.
- Flag any high/critical CVEs you notice and propose fixes.

## Node-Specific Hardening
- Use `npm`/`pnpm` scripts safely; avoid `postinstall` hooks unless required.
- Beware of path traversal; always resolve/normalize paths.
- Enforce least privilege on file access and environment variables.
- Favor `node:20` LTS features and stable APIs.

## Testing Expectations
- Add or update tests for new behavior; prioritize security-relevant cases.
- Include negative tests for invalid inputs and boundary conditions.
- Keep tests deterministic and fast; avoid network and time flakiness.

## Build/Run Safety
- Avoid commands that delete or overwrite existing files without confirmation.
- Prefer non-destructive scaffolding and clear migration steps.

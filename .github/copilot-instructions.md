# Copilot Instructions (GOFR Console)

## Core
- Dev container + Docker access.
- Never use `localhost`; use service hostnames (e.g., `gofr-neo4j`).
- Prefer repo control scripts for services/auth/ingestion/tests.
- Keep code simple; debug basics first (env, health, logs, auth, connectivity).
- If user reminds a preferred pattern, add it here.

## Security
- Treat inputs as hostile; validate/sanitize.
- Avoid `eval`/`Function`/dynamic `require`/unsafe deserialization.
- Prefer safe APIs (`fs/promises`, `path`, `URL`); avoid shelling out.
- Never log secrets/PII.

## Dependencies & CVEs
- Minimize deps; prefer maintained packages.
- Check for CVEs; flag high/critical issues.
- Pin versions where feasible.
- Run `pnpm run security` or `./scripts/security-scan.sh` before commits.
- Tools: pnpm audit, ESLint security plugin, Semgrep (SAST), Trivy (image scan).

## Node Hardening
- Avoid risky `postinstall` scripts.
- Prevent path traversal; normalize/resolve paths.
- Enforce least privilege for files/env.
- Target Node 20 LTS features.

## Testing
- Add/update tests; include negative/boundary cases.
- Keep tests fast and deterministic.

## Build/Run Safety
- Don’t run destructive commands without confirmation.

## Logging
- Use the **project logger** (e.g., `StructuredLogger`), **not** `print()` or default logging.
- Logs must be **clear and actionable**, not cryptic.
- All errors must include **cause, references/context**, and **recovery options** where possible.
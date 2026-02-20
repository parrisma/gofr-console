# Code quality gates (TypeScript/React)

This folder contains the code-quality gate used by the project test runner (Vitest).

The gate is implemented in `tests/code_quality/code_quality.test.ts`.

## How to run

Preferred (project standard):

- `./scripts/code-quality.sh`

Run only the code quality gate:

- `pnpm exec vitest run tests/code_quality -v`

## What is enforced

The code quality gate enforces:

- ESLint: no lint errors (zero warnings).
- TypeScript: no type errors (app + node tsconfig).
- Large source file limit (src/ only): fails if any `src/**/*.{ts,tsx}` exceeds 1000 lines.
- Function complexity (src/ only): ESLint `complexity` rule, threshold 40.

Notes:

- The large-file and complexity gates are intentionally scoped to runtime code under `src/`.
- Allowlisted items are not silent: they emit warnings so hotspots stay visible.

## Allowlist JSON

Some existing hotspots are allowlisted to enable incremental cleanup.

Default allowlist file:

- `tests/code_quality/allow.json`

Override allowlist file:

- `CODE_QUALITY_ALLOWLIST_FILE=path/to/allow.json pnpm exec vitest run tests/code_quality -v`

Path rules:

- If `CODE_QUALITY_ALLOWLIST_FILE` is relative, it is resolved relative to the repo root.
- Allowlist entries use repo-relative POSIX paths (for example: `src/services/api/index.ts`).

Schema (v1):

- `large_files`: array of strings (file paths)
- `complexity`: array of objects `{ "file": "...", "function": "..." }`

Example:

{
  "large_files": [
    "src/services/api/index.ts"
  ],
  "complexity": [
    {"file": "src/pages/GofrDigSessions.tsx", "function": "GofrDigSessions"}
  ]
}

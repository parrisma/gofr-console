#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "Running TypeScript type-check (app config)..."
pnpm exec tsc -p tsconfig.app.json --noEmit --pretty false --noErrorTruncation

echo "Running TypeScript type-check (node config)..."
pnpm exec tsc -p tsconfig.node.json --noEmit --pretty false --noErrorTruncation

echo "Running ESLint on src/..."
pnpm exec eslint "src/**/*.{ts,tsx}" --max-warnings=0 --report-unused-disable-directives

echo "Code quality checks completed successfully."

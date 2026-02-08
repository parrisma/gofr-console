#!/bin/bash
# Start GOFR Console Web UI (Vite dev server)
#
# Usage:
#   ./scripts/start-ui.sh [OPTIONS]
#
# Options:
#   --port PORT    Override Vite dev server port (default: 3000)
#   --install      Force pnpm install before starting
#   -h, --help     Show this help

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEV_PORT=3000
FORCE_INSTALL=false

# --- Parse args ---
while [ $# -gt 0 ]; do
    case $1 in
        --port)
            DEV_PORT="$2"
            shift 2
            ;;
        --install)
            FORCE_INSTALL=true
            shift
            ;;
        -h|--help)
            head -12 "$0" | tail -10
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

cd "$PROJECT_ROOT"

# --- Pre-flight checks ---

# Ensure pnpm is available
if ! command -v pnpm &>/dev/null; then
    echo "ERROR: pnpm is not installed. Install it with: npm install -g pnpm" >&2
    exit 1
fi

# Install dependencies if node_modules is missing or --install flag set
if [ "$FORCE_INSTALL" = true ] || [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    pnpm install
fi

# --- Start Vite dev server ---
echo "Starting GOFR Console on port ${DEV_PORT}..."
echo "  Local:   http://localhost:${DEV_PORT}"
echo "  Network: http://0.0.0.0:${DEV_PORT}"
echo ""

exec pnpm dev -- --port "$DEV_PORT"

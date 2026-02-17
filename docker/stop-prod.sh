#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# stop-prod.sh — Stop the GOFR Console production stack
#
# Wraps `docker compose -f docker/compose.prod.yml down` with optional
# volume cleanup.
#
# Usage:
#   ./docker/stop-prod.sh                # stop & remove containers
#   ./docker/stop-prod.sh --volumes      # also remove data/log volumes
#   ./docker/stop-prod.sh --status       # show current status then exit
#
# This is a convenience wrapper; `start-prod.sh --down` does the same thing.
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/compose.prod.yml"

# ── Defaults ──────────────────────────────────────────────────────────────
REMOVE_VOLUMES=false
STATUS_ONLY=false

# ── Colours ───────────────────────────────────────────────────────────────
readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[0;33m'
readonly CYAN=$'\033[0;36m'
readonly RESET=$'\033[0m'

info()  { echo "${CYAN}[stop-prod]${RESET} $*"; }
ok()    { echo "${GREEN}[stop-prod]${RESET} $*"; }
warn()  { echo "${YELLOW}[stop-prod]${RESET} $*"; }
die()   { echo "${RED}[stop-prod]${RESET} $*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: stop-prod.sh [OPTIONS]

Options:
  --volumes, -v     Also remove data and log volumes (destructive)
  --status          Show stack status and exit
  -h, --help        Show this help
EOF
    exit 0
}

# ── Parse arguments ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --volumes|-v) REMOVE_VOLUMES=true; shift ;;
        --status)     STATUS_ONLY=true; shift ;;
        -h|--help)    usage ;;
        *) die "Unknown option: $1  (try --help)" ;;
    esac
done

# ── Preflight ────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker CLI not found"

if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
else
    die "Neither 'docker compose' plugin nor 'docker-compose' found"
fi

COMPOSE_CMD="$COMPOSE -f $COMPOSE_FILE"

cd "$PROJECT_ROOT"

# ── Status-only mode ─────────────────────────────────────────────────────
if $STATUS_ONLY; then
    $COMPOSE_CMD ps -a
    exit 0
fi

# ── Check if anything is running ─────────────────────────────────────────
RUNNING=$(docker ps -q --filter "name=gofr-console" 2>/dev/null || true)
if [[ -z "$RUNNING" ]]; then
    warn "No running gofr-console container found"
fi

# ── Stop stack ───────────────────────────────────────────────────────────
info "Stopping GOFR Console stack …"

DOWN_ARGS="--remove-orphans"
if $REMOVE_VOLUMES; then
    warn "Removing volumes (gofr-console-data, gofr-console-logs)"
    DOWN_ARGS="$DOWN_ARGS --volumes"
fi

$COMPOSE_CMD down $DOWN_ARGS

ok "Stack stopped"

# ── Summary ──────────────────────────────────────────────────────────────
if $REMOVE_VOLUMES; then
    echo ""
    warn "Data and log volumes have been removed."
    warn "Run start-prod.sh --seed-data to re-create them on next start."
fi

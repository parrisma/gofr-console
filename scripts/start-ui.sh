#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# start-ui.sh — Start the GOFR Console Web UI (Vite dev server)
#
# Production-grade: lockfile integrity checks, graceful shutdown, health
# probes, log-to-file, PID tracking, and automatic stale-process cleanup.
#
# Usage:
#   ./scripts/start-ui.sh [OPTIONS]
#
# Options:
#   --port PORT       Vite dev server port          (default: 3000)
#   --host HOST       Vite bind address              (default: 0.0.0.0)
#   --install         Force pnpm install before start
#   --ci              Strict mode: frozen lockfile, no interaction
#   --log FILE        Redirect Vite output to FILE   (default: stdout)
#   --background      Daemonise: fork, write PID, exit
#   --stop            Stop a previously daemonised instance
#   --status          Show whether the UI is running
#   --timeout SECS    Health-probe timeout after start (default: 30)
#   -q, --quiet       Suppress banner / informational output
#   -h, --help        Show this help
#
# Environment:
#   GOFR_UI_PORT      Same as --port
#   GOFR_UI_HOST      Same as --host
#   NODE_ENV          Forwarded to Vite
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$PROJECT_ROOT/.vite.pid"
DEFAULT_LOG="$PROJECT_ROOT/logs/vite-dev.log"

# ── Defaults ──────────────────────────────────────────────────────────────
DEV_PORT="${GOFR_UI_PORT:-3000}"
DEV_HOST="${GOFR_UI_HOST:-0.0.0.0}"
FORCE_INSTALL=false
CI_MODE=false
LOG_FILE=""
BACKGROUND=false
STOP=false
STATUS=false
HEALTH_TIMEOUT=30
QUIET=false

# ── Helpers ───────────────────────────────────────────────────────────────
readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[0;33m'
readonly CYAN=$'\033[0;36m'
readonly RESET=$'\033[0m'

log()  { [[ "$QUIET" == true ]] && return; printf '%s %s\n' "$(date +%H:%M:%S)" "$*"; }
info() { log "${CYAN}ℹ${RESET} $*"; }
ok()   { log "${GREEN}✓${RESET} $*"; }
warn() { log "${YELLOW}⚠${RESET} $*" >&2; }
die()  { log "${RED}✗${RESET} $*" >&2; exit 1; }

usage() {
  # Print the comment block at the top of this file
  sed -n '/^# Usage:/,/^# ──/{ /^# ──/d; s/^# \?//; p }' "$0"
  exit 0
}

# ── Argument parsing ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --port)       DEV_PORT="$2";       shift 2 ;;
    --host)       DEV_HOST="$2";       shift 2 ;;
    --install)    FORCE_INSTALL=true;  shift   ;;
    --ci)         CI_MODE=true;        shift   ;;
    --log)        LOG_FILE="$2";       shift 2 ;;
    --background) BACKGROUND=true;     shift   ;;
    --stop)       STOP=true;           shift   ;;
    --status)     STATUS=true;         shift   ;;
    --timeout)    HEALTH_TIMEOUT="$2"; shift 2 ;;
    -q|--quiet)   QUIET=true;          shift   ;;
    -h|--help)    usage ;;
    *)            die "Unknown option: $1 (see --help)" ;;
  esac
done

# ── Validate numeric inputs ──────────────────────────────────────────────
[[ "$DEV_PORT" =~ ^[0-9]+$ ]]       || die "--port must be a number (got '$DEV_PORT')"
[[ "$HEALTH_TIMEOUT" =~ ^[0-9]+$ ]] || die "--timeout must be a number (got '$HEALTH_TIMEOUT')"
(( DEV_PORT >= 1 && DEV_PORT <= 65535 )) || die "Port out of range: $DEV_PORT"

cd "$PROJECT_ROOT"

# ── PID helpers ───────────────────────────────────────────────────────────
read_pid() {
  [[ -f "$PID_FILE" ]] && cat "$PID_FILE" || echo ""
}

is_running() {
  local pid
  pid="$(read_pid)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

cleanup_pid() {
  rm -f "$PID_FILE"
}

# ── --stop ────────────────────────────────────────────────────────────────
if [[ "$STOP" == true ]]; then
  pid="$(read_pid)"
  if [[ -z "$pid" ]]; then
    warn "No PID file found — nothing to stop."
    exit 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    info "Sending SIGTERM to PID $pid …"
    kill "$pid"
    # Wait up to 10 s for graceful exit
    for i in $(seq 1 10); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      warn "Process $pid did not exit — sending SIGKILL"
      kill -9 "$pid" 2>/dev/null || true
    fi
    ok "Stopped."
  else
    warn "PID $pid is not running (stale PID file)"
  fi
  cleanup_pid
  exit 0
fi

# ── --status ──────────────────────────────────────────────────────────────
if [[ "$STATUS" == true ]]; then
  if is_running; then
    ok "GOFR Console is running (PID $(read_pid))"
    exit 0
  else
    warn "GOFR Console is not running"
    cleanup_pid
    exit 1
  fi
fi

# ── Pre-flight checks ────────────────────────────────────────────────────
command -v pnpm &>/dev/null || die "pnpm is not installed. Install with: npm install -g pnpm"
command -v node &>/dev/null || die "node is not on PATH"

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
(( NODE_MAJOR >= 18 )) || die "Node ≥ 18 required (found $(node -v))"

# Lockfile integrity
[[ -f pnpm-lock.yaml ]] || die "pnpm-lock.yaml not found — run pnpm install first"

# Port conflict check
if command -v ss &>/dev/null; then
  if ss -tlnp 2>/dev/null | grep -q ":${DEV_PORT} "; then
    existing="$(ss -tlnp 2>/dev/null | grep ":${DEV_PORT} " | head -1)"
    die "Port $DEV_PORT is already in use:\n  $existing"
  fi
elif command -v lsof &>/dev/null; then
  if lsof -iTCP:"$DEV_PORT" -sTCP:LISTEN -t &>/dev/null; then
    die "Port $DEV_PORT is already in use"
  fi
fi

# Stale PID cleanup
if [[ -f "$PID_FILE" ]]; then
  old_pid="$(read_pid)"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    die "Another instance is already running (PID $old_pid). Use --stop first."
  fi
  warn "Removing stale PID file (PID $old_pid)"
  cleanup_pid
fi

# ── Install dependencies ─────────────────────────────────────────────────
if [[ "$FORCE_INSTALL" == true ]] || [[ ! -d node_modules ]]; then
  info "Installing dependencies …"
  if [[ "$CI_MODE" == true ]]; then
    pnpm install --frozen-lockfile
  else
    pnpm install
  fi
  ok "Dependencies installed"
fi

# ── Prepare log directory ────────────────────────────────────────────────
if [[ "$BACKGROUND" == true && -z "$LOG_FILE" ]]; then
  LOG_FILE="$DEFAULT_LOG"
fi
if [[ -n "$LOG_FILE" ]]; then
  mkdir -p "$(dirname "$LOG_FILE")"
fi

# ── Graceful shutdown handler ─────────────────────────────────────────────
on_exit() {
  cleanup_pid
  info "GOFR Console stopped."
}
trap on_exit EXIT INT TERM

# ── Build Vite args ──────────────────────────────────────────────────────
VITE_ARGS=(--port "$DEV_PORT" --host "$DEV_HOST")
if [[ "$CI_MODE" == true ]]; then
  VITE_ARGS+=(--strictPort)
fi

# ── Banner ────────────────────────────────────────────────────────────────
if [[ "$QUIET" != true ]]; then
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  GOFR Console  ·  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  Port:    $DEV_PORT"
  echo "  Host:    $DEV_HOST"
  echo "  Node:    $(node -v)  ·  pnpm $(pnpm -v)"
  echo "  Mode:    ${NODE_ENV:-development}"
  [[ -n "$LOG_FILE" ]] && echo "  Log:     $LOG_FILE"
  echo "───────────────────────────────────────────────────────────────────"
  echo "  Local:   http://localhost:${DEV_PORT}"
  echo "  Network: http://${DEV_HOST}:${DEV_PORT}"
  echo "═══════════════════════════════════════════════════════════════════"
  echo ""
fi

# ── Health probe (async) ─────────────────────────────────────────────────
# Runs in the background; once the server responds, logs a confirmation.
health_probe() {
  local url="http://127.0.0.1:${DEV_PORT}/"
  local elapsed=0
  while (( elapsed < HEALTH_TIMEOUT )); do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      ok "Health check passed — UI is serving at $url"
      return 0
    fi
    sleep 1
    (( elapsed++ )) || true
  done
  warn "Health probe timed out after ${HEALTH_TIMEOUT}s — server may still be starting"
  return 1
}

# ── Start ─────────────────────────────────────────────────────────────────
if [[ "$BACKGROUND" == true ]]; then
  info "Starting in background (log → $LOG_FILE) …"
  nohup pnpm dev -- "${VITE_ARGS[@]}" >> "$LOG_FILE" 2>&1 &
  VITE_PID=$!
  echo "$VITE_PID" > "$PID_FILE"
  # Detach the trap so the parent shell can exit cleanly
  trap - EXIT
  ok "Backgrounded (PID $VITE_PID)"
  health_probe
  exit $?
else
  echo $$ > "$PID_FILE"
  if [[ -n "$LOG_FILE" ]]; then
    exec pnpm dev -- "${VITE_ARGS[@]}" >> "$LOG_FILE" 2>&1
  else
    exec pnpm dev -- "${VITE_ARGS[@]}"
  fi
fi

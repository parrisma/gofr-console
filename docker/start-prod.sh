#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# start-prod.sh — Start (or manage) the GOFR Console production stack
#
# Wraps `docker compose -f docker/compose.prod.yml` with ergonomic flags,
# automatic image building, network creation, and health verification.
#
# Usage:
#   ./docker/start-prod.sh                # build if needed, then start
#   ./docker/start-prod.sh --build        # force rebuild before start
#   ./docker/start-prod.sh --port 8000    # host port override
#   ./docker/start-prod.sh --seed-data     # re-seed data volume from repo defaults
#   ./docker/start-prod.sh --down         # stop & remove containers
#   ./docker/start-prod.sh --restart      # restart running stack
#   ./docker/start-prod.sh --status       # show service status
#   ./docker/start-prod.sh --logs         # tail logs
#   ./docker/start-prod.sh --logs -n 100  # last 100 lines
#
# Environment:
#   GOFR_CONSOLE_PORT      Host port (default: 3100)
#   TZ                     Timezone for nginx logs
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/compose.prod.yml"

# ── Defaults ──────────────────────────────────────────────────────────────
CONSOLE_PORT="${GOFR_CONSOLE_PORT:-3100}"
FORCE_BUILD=false
SEED_DATA=true
ACTION="up"           # up | down | restart | status | logs
LOG_LINES=""
BUILD_ARGS=""

# ── Colours ───────────────────────────────────────────────────────────────
readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[0;33m'
readonly CYAN=$'\033[0;36m'
readonly BOLD=$'\033[1m'
readonly RESET=$'\033[0m'

info()  { echo "${CYAN}[start-prod]${RESET} $*"; }
ok()    { echo "${GREEN}[start-prod]${RESET} $*"; }
warn()  { echo "${YELLOW}[start-prod]${RESET} $*"; }
die()   { echo "${RED}[start-prod]${RESET} $*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: start-prod.sh [OPTIONS]

Options:
  --port PORT         Host port for the console  (default: 3100)
  --build             Force-rebuild image before starting
  --build-arg ARG     Extra docker build arg      (repeatable)
  --seed-data         (Re-)seed the data volume from repo defaults
  --down              Stop and remove the stack
  --restart           Restart the running stack
  --status            Show container status
  --logs [-n N]       Tail container logs
  -h, --help          Show this help
EOF
    exit 0
}

# ── Parse arguments ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --port)      CONSOLE_PORT="${2:?--port requires a value}"; shift 2 ;;
        --build)     FORCE_BUILD=true; shift ;;
        --seed-data) SEED_DATA=true; shift ;;
        --build-arg) BUILD_ARGS="$BUILD_ARGS $2"; shift 2 ;;
        --down)      ACTION="down"; shift ;;
        --restart)   ACTION="restart"; shift ;;
        --status)    ACTION="status"; shift ;;
        --logs)      ACTION="logs"; shift
                     if [[ "${1:-}" == "-n" ]]; then
                         LOG_LINES="${2:?-n requires a number}"; shift 2
                     fi
                     ;;
        -h|--help)   usage ;;
        *) die "Unknown option: $1  (try --help)" ;;
    esac
done

# ── Preflight ────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker CLI not found"

# Compose command — support both v2 plugin and standalone
if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
else
    die "Neither 'docker compose' plugin nor 'docker-compose' found"
fi

COMPOSE_CMD="$COMPOSE -f $COMPOSE_FILE"

cd "$PROJECT_ROOT"

# ── Helpers ──────────────────────────────────────────────────────────────
ensure_network() {
    if ! docker network inspect gofr-net >/dev/null 2>&1; then
        info "Creating Docker network: gofr-net"
        docker network create gofr-net
        ok "Network gofr-net created"
    fi
}

ensure_image() {
    local image_name="gofr-console-prod:latest"
    if $FORCE_BUILD || ! docker image inspect "$image_name" >/dev/null 2>&1; then
        info "Building production image …"
        bash "$SCRIPT_DIR/build-prod.sh" ${BUILD_ARGS:+$BUILD_ARGS}
    else
        ok "Image $image_name already exists (use --build to force rebuild)"
    fi
}
# Seed the data volume with defaults from the repo (config + logs dir)
seed_data_volume() {
    local vol_name="gofr-console-data"
    local log_vol="gofr-console-logs"
    # Create volumes if they don't exist yet
    for v in "$vol_name" "$log_vol"; do
        if ! docker volume inspect "$v" >/dev/null 2>&1; then
            docker volume create "$v" >/dev/null
            info "Created volume $v"
        fi
    done
    info "Seeding data volume with repo defaults \u2026"
    docker run --rm \
        -v "$vol_name:/data" \
        alpine:3.20 sh -c '
            mkdir -p /data/config /data/logs
            chown -R 101:101 /data
        '
    # Seed from the built image (no host volume mounts)
    local tmp_ctr
    tmp_ctr=$(docker create gofr-console-prod:latest true)
    docker cp "$tmp_ctr:/data/config/ui-config.json" - | docker run --rm -i -v "$vol_name:/data" alpine:3.20 sh -c 'tar xf - -C /data' 2>/dev/null || true
    docker cp "$tmp_ctr:/data/config/users.json" - | docker run --rm -i -v "$vol_name:/data" alpine:3.20 sh -c 'tar xf - -C /data' 2>/dev/null || true
    docker rm "$tmp_ctr" >/dev/null 2>&1 || true
    # Fix ownership
    docker run --rm -v "$vol_name:/data" alpine:3.20 chown -R 101:101 /data
    ok "Data volume seeded (config + logs dirs)"
}
wait_healthy() {
    local timeout=40
    local elapsed=0
    local interval=2
    info "Waiting for health check (timeout: ${timeout}s) …"
    while (( elapsed < timeout )); do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' gofr-console 2>/dev/null || echo "missing")
        case "$health" in
            healthy)
                ok "Container is healthy"
                return 0
                ;;
            unhealthy)
                die "Container entered unhealthy state — check 'docker logs gofr-console'"
                ;;
        esac
        sleep "$interval"
        elapsed=$(( elapsed + interval ))
    done
    warn "Health check timed out after ${timeout}s (container may still be starting)"
}

# ── Dispatch action ──────────────────────────────────────────────────────
case "$ACTION" in
    # ── DOWN ──────────────────────────────────────────────────────────────
    down)
        info "Stopping GOFR Console stack …"
        GOFR_CONSOLE_PORT="$CONSOLE_PORT" \
            $COMPOSE_CMD down --remove-orphans
        ok "Stack stopped"
        ;;

    # ── RESTART ───────────────────────────────────────────────────────────
    restart)
        info "Restarting GOFR Console …"
        $COMPOSE_CMD restart
        wait_healthy
        ok "Restarted on port ${CONSOLE_PORT}"
        ;;

    # ── STATUS ────────────────────────────────────────────────────────────
    status)
        $COMPOSE_CMD ps -a
        ;;

    # ── LOGS ──────────────────────────────────────────────────────────────
    logs)
        if [[ -n "$LOG_LINES" ]]; then
            $COMPOSE_CMD logs --tail="$LOG_LINES" -f
        else
            $COMPOSE_CMD logs -f
        fi
        ;;

    # ── UP (default) ─────────────────────────────────────────────────────
    up)
        ensure_network
        ensure_image

        echo ""
        echo "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
        echo "${BOLD} GOFR Console — Production${RESET}"
        echo "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
        echo "  Port       : ${CONSOLE_PORT}"
        echo "  Compose    : ${COMPOSE_FILE}"
        echo "  Data vol   : gofr-console-data"
        echo "  Logs vol   : gofr-console-logs"
        echo ""

        # Seed data volume on first run (or when --seed-data is passed)
        if $SEED_DATA || ! docker volume inspect gofr-console-data >/dev/null 2>&1; then
            seed_data_volume
        fi

        # Export env for compose interpolation
        export GOFR_CONSOLE_PORT="$CONSOLE_PORT"

        $COMPOSE_CMD up -d --remove-orphans

        wait_healthy

        echo ""
        ok "GOFR Console is running"
        echo ""
        echo "  ${BOLD}URL${RESET}:  http://localhost:${CONSOLE_PORT}"
        echo ""
        echo "  Useful commands:"
        echo "    $0 --logs          # tail logs"
        echo "    $0 --status        # container status"
        echo "    $0 --restart       # restart"
        echo "    $0 --down          # stop & remove"
        echo ""
        ;;
esac

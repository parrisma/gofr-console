#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# build-prod.sh — Build the GOFR Console production Docker image
#
# Multi-stage build: Node 20 → pnpm build → nginx:alpine (static assets).
#
# Usage:
#   ./docker/build-prod.sh              # standard build
#   ./docker/build-prod.sh --no-cache   # force full rebuild
#   ./docker/build-prod.sh --tag v1.2.3 # custom tag (also tags :latest)
#   ./docker/build-prod.sh --push       # push to registry after build
#
# Environment:
#   GOFR_CONSOLE_REGISTRY   Registry prefix (e.g. ghcr.io/myorg)
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Defaults ──────────────────────────────────────────────────────────────
IMAGE_NAME="gofr-console-prod"
TAG="latest"
REGISTRY="${GOFR_CONSOLE_REGISTRY:-}"
NO_CACHE=""
PUSH=false

# ── Colours ───────────────────────────────────────────────────────────────
readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[0;33m'
readonly CYAN=$'\033[0;36m'
readonly RESET=$'\033[0m'

info()  { echo "${CYAN}[build-prod]${RESET} $*"; }
ok()    { echo "${GREEN}[build-prod]${RESET} $*"; }
warn()  { echo "${YELLOW}[build-prod]${RESET} $*"; }
die()   { echo "${RED}[build-prod]${RESET} $*" >&2; exit 1; }

# ── Parse arguments ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-cache)  NO_CACHE="--no-cache"; shift ;;
        --tag)       TAG="${2:?--tag requires a value}"; shift 2 ;;
        --push)      PUSH=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--no-cache] [--tag TAG] [--push] [-h|--help]"
            exit 0
            ;;
        *) die "Unknown option: $1" ;;
    esac
done

# ── Preflight checks ────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker CLI not found"

cd "$PROJECT_ROOT"

# Ensure lockfile exists (frozen install in Dockerfile needs it)
[[ -f pnpm-lock.yaml ]] || die "pnpm-lock.yaml not found — run 'pnpm install' first"

# Build hash for cache-busting / traceability
BUILD_HASH="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Full image references
FULL_TAG="${IMAGE_NAME}:${TAG}"
LATEST_TAG="${IMAGE_NAME}:latest"

# ── Build ────────────────────────────────────────────────────────────────
info "Building ${FULL_TAG}"
info "  Build hash : ${BUILD_HASH}"
info "  Build date : ${BUILD_DATE}"
info "  Dockerfile : docker/Dockerfile.prod"
info "  Context    : ${PROJECT_ROOT}"
[[ -n "$NO_CACHE" ]] && warn "  Cache      : disabled (--no-cache)"
echo ""

docker build \
    -f docker/Dockerfile.prod \
    --build-arg "VITE_BUILD_HASH=${BUILD_HASH}" \
    --label "org.opencontainers.image.created=${BUILD_DATE}" \
    --label "org.opencontainers.image.revision=${BUILD_HASH}" \
    ${NO_CACHE} \
    -t "${FULL_TAG}" \
    .

# Also tag :latest unless the caller already supplied "latest"
if [[ "$TAG" != "latest" ]]; then
    docker tag "${FULL_TAG}" "${LATEST_TAG}"
    ok "Tagged ${LATEST_TAG}"
fi

echo ""
ok "Build complete: ${FULL_TAG}"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"

# ── Optional: push ───────────────────────────────────────────────────────
if $PUSH; then
    if [[ -z "$REGISTRY" ]]; then
        die "Cannot --push without GOFR_CONSOLE_REGISTRY set (e.g. ghcr.io/myorg)"
    fi
    REMOTE_TAG="${REGISTRY}/${FULL_TAG}"
    REMOTE_LATEST="${REGISTRY}/${LATEST_TAG}"
    info "Pushing ${REMOTE_TAG} …"
    docker tag "${FULL_TAG}" "${REMOTE_TAG}"
    docker push "${REMOTE_TAG}"
    if [[ "$TAG" != "latest" ]]; then
        docker tag "${LATEST_TAG}" "${REMOTE_LATEST}"
        docker push "${REMOTE_LATEST}"
    fi
    ok "Pushed to ${REGISTRY}"
fi

#!/bin/bash
# Run GOFR-Console development container
# React + MUI frontend development environment
# Standard user: gofr (UID 1000, GID 1000)
#
# Usage:
#   ./scripts/run-dev.sh [OPTIONS]
#
# Options:
#   --port PORT          Override Vite dev server port (default: 3000)
#   --network NAME       Docker network (default: gofr-net)
#   -h, --help           Show this help
#
# REQUIREMENTS:
#   - Docker must be installed and running
#   - gofr-console-dev:latest image must be built (run docker/build-dev.sh)
#
# This container provides an isolated development environment with:
#   - Access to host Docker socket
#   - Project mounted at /home/gofr/devroot/gofr-console
#   - Port 3000 exposed for Vite dev server
#
# See docs/development.md for full development setup guide.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Standard GOFR user - all projects use same user
GOFR_USER="gofr"
IMAGE_UID=1000
IMAGE_GID=1000

# Detect host user's UID/GID for bind-mount ownership matching
HOST_UID=$(id -u)
HOST_GID=$(id -g)

# Container and image names
CONTAINER_NAME="gofr-console-dev"
IMAGE_NAME="gofr-console-dev:latest"

# Default port for Vite dev server
DEV_PORT=3000
DOCKER_NETWORK="gofr-net"

# Parse command line arguments
while [ $# -gt 0 ]; do
    case $1 in
        --port)
            DEV_PORT="$2"
            shift 2
            ;;
        --network)
            DOCKER_NETWORK="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--port PORT] [--network NAME]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--port PORT] [--network NAME]"
            exit 1
            ;;
    esac
done

echo "======================================================================="
echo "Starting GOFR-Console Development Container"
echo "======================================================================="
echo "Image user: ${GOFR_USER} (UID=${IMAGE_UID}, GID=${IMAGE_GID})"
echo "Host user:  $(whoami) (UID=${HOST_UID}, GID=${HOST_GID})"
if [ "$HOST_UID" != "$IMAGE_UID" ] || [ "$HOST_GID" != "$IMAGE_GID" ]; then
    echo "  → overriding container user to ${HOST_UID}:${HOST_GID}"
else
    echo "  → UID/GID match, using image default"
fi
echo "Port: $DEV_PORT (Vite dev server)"
echo "Network: $DOCKER_NETWORK"
echo "======================================================================="

# Create docker network if it doesn't exist
if ! docker network inspect $DOCKER_NETWORK >/dev/null 2>&1; then
    echo "Creating network: $DOCKER_NETWORK"
    docker network create $DOCKER_NETWORK
fi

# Stop and remove existing container
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping existing container: $CONTAINER_NAME"
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# Get docker socket group ID for proper permissions
DOCKER_SOCK_GID=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo "999")

# Build docker run args — conditionally add --user if host UID/GID differs
RUN_ARGS=(
    -d
    --name "$CONTAINER_NAME"
    --network "$DOCKER_NETWORK"
    -p "${DEV_PORT}:3000"
    -v "$PROJECT_ROOT:/home/gofr/devroot/gofr-console:rw"
    -v /var/run/docker.sock:/var/run/docker.sock:rw
    --group-add "${DOCKER_SOCK_GID}"
    -e NODE_ENV=development
)

if [ "$HOST_UID" != "$IMAGE_UID" ] || [ "$HOST_GID" != "$IMAGE_GID" ]; then
    RUN_ARGS+=(--user "${HOST_UID}:${HOST_GID}")
fi

# Run container with Docker socket mounted
docker run "${RUN_ARGS[@]}" "$IMAGE_NAME"

echo ""
echo "======================================================================="
echo "Container started: $CONTAINER_NAME"
echo "======================================================================="
echo ""
echo "To enter container:"
echo "  docker exec -it $CONTAINER_NAME bash"
echo ""
echo "To start dev server:"
echo "  pnpm install"
echo "  pnpm dev"
echo ""

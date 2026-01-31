#!/bin/bash
# Build GOFR-Console development image
# React + MUI frontend development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Get user's UID/GID for permission matching
USER_UID=$(id -u)
USER_GID=$(id -g)

echo "======================================================================="
echo "Building GOFR-Console Development Image"
echo "======================================================================="
echo "User UID: $USER_UID"
echo "User GID: $USER_GID"
echo "======================================================================="

echo ""
echo "Building gofr-console-dev:latest..."
docker build \
    -f "$SCRIPT_DIR/Dockerfile.dev" \
    --build-arg UID=$USER_UID \
    --build-arg GID=$USER_GID \
    -t gofr-console-dev:latest \
    "$PROJECT_ROOT"

echo ""
echo "======================================================================="
echo "Build complete: gofr-console-dev:latest"
echo "======================================================================="
echo ""
echo "Image size:"
docker images gofr-console-dev:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

#!/bin/bash
# Security scanning script for GOFR Console
# Runs multiple security checks: dependency audit, SAST, Docker image scanning

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "======================================================================="
echo "GOFR Console Security Scan"
echo "======================================================================="

# Check if running in CI or locally
CI_MODE=${CI:-false}

# Track failures
FAILED=0

echo ""
echo "[1/4] Running pnpm audit..."
echo "-----------------------------------------------------------------------"
if pnpm audit --prod --audit-level=moderate; then
    echo "✓ No moderate or higher vulnerabilities found"
else
    echo "✗ Vulnerabilities detected in dependencies"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "[2/4] Running ESLint with security rules..."
echo "-----------------------------------------------------------------------"
if pnpm run lint; then
    echo "✓ No linting issues found"
else
    echo "✗ Linting issues detected"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "[3/5] Running unit tests..."
echo "-----------------------------------------------------------------------"
if pnpm run test:unit; then
    echo "✓ Unit tests passed"
else
    echo "✗ Unit tests failed"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "[4/5] Checking for Semgrep..."
echo "-----------------------------------------------------------------------"
if command -v semgrep >/dev/null 2>&1; then
    echo "Running Semgrep SAST..."
    if semgrep --config=auto --quiet --error .; then
        echo "✓ No security issues found by Semgrep"
    else
        echo "✗ Semgrep detected potential security issues"
        FAILED=$((FAILED + 1))
    fi
else
    echo "⚠ Semgrep not installed. Install: pip install semgrep"
    if [ "$CI_MODE" = "true" ]; then
        FAILED=$((FAILED + 1))
    fi
fi

echo ""
echo "[5/5] Checking for Trivy (Docker image scanning)..."
echo "-----------------------------------------------------------------------"
if command -v trivy >/dev/null 2>&1; then
    if docker images gofr-console-dev:latest >/dev/null 2>&1; then
        echo "Running Trivy on gofr-console-dev:latest..."
        if trivy image --severity HIGH,CRITICAL --exit-code 1 gofr-console-dev:latest; then
            echo "✓ No high/critical vulnerabilities in Docker image"
        else
            if [ "$CI_MODE" = "true" ]; then
                echo "✗ Trivy detected vulnerabilities in Docker image (blocking in CI)"
                FAILED=$((FAILED + 1))
            else
                echo "⚠ Trivy detected vulnerabilities in Docker image (non-blocking locally)"
                echo "  Hint: rebuild the dev image, upgrade base packages, or address CVEs in docker/Dockerfile.dev"
            fi
        fi
    else
        echo "⚠ Docker image gofr-console-dev:latest not found. Build it first."
    fi
else
    echo "⚠ Trivy not installed. Install: https://github.com/aquasecurity/trivy"
    if [ "$CI_MODE" = "true" ]; then
        FAILED=$((FAILED + 1))
    fi
fi

echo ""
echo "======================================================================="
if [ $FAILED -eq 0 ]; then
    echo "✓ All security checks passed"
    echo "======================================================================="
    exit 0
else
    echo "✗ $FAILED check(s) failed"
    echo "======================================================================="
    exit 1
fi

#!/bin/bash
# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
#
# Run full end-to-end test suite for TYTX HTTP integration.
#
# Usage: ./run_e2e.sh [python|js|unit|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$SCRIPT_DIR"

echo "=========================================="
echo "TYTX End-to-End Test Suite"
echo "=========================================="
echo ""

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    pkill -f "server_asgi.py" 2>/dev/null || true
    pkill -f "server_wsgi.py" 2>/dev/null || true
}
trap cleanup EXIT

# Check dependencies
check_deps() {
    echo "Checking dependencies..."

    if ! python -c "import uvicorn" 2>/dev/null; then
        echo "WARNING: uvicorn not installed. ASGI server won't work."
        echo "Install with: pip install uvicorn"
    fi

    if ! command -v node &>/dev/null; then
        echo "WARNING: Node.js not installed. JS tests will be skipped."
    fi

    echo ""
}

# Wait for server
wait_for_server() {
    local url=$1
    local timeout=${2:-10}
    local start=$(date +%s)

    while true; do
        if curl -s "$url" >/dev/null 2>&1; then
            return 0
        fi
        local now=$(date +%s)
        if [ $((now - start)) -ge $timeout ]; then
            return 1
        fi
        sleep 0.5
    done
}

run_python_e2e() {
    echo "------------------------------------------"
    echo "Running Python E2E Tests"
    echo "------------------------------------------"

    cd "$SCRIPT_DIR"
    python -m pytest test_e2e_python.py -v --tb=short

    echo ""
}

run_js_e2e() {
    echo "------------------------------------------"
    echo "Running JavaScript E2E Tests"
    echo "------------------------------------------"

    # Start server
    echo "Starting ASGI server..."
    cd "$SCRIPT_DIR"
    python server_asgi.py &
    SERVER_PID=$!

    if ! wait_for_server "http://127.0.0.1:8765/health" 10; then
        echo "ERROR: Server failed to start"
        kill $SERVER_PID 2>/dev/null || true
        return 1
    fi

    echo "Server ready, running tests..."

    # Run tests
    node test_e2e_js_standalone.mjs

    # Stop server
    kill $SERVER_PID 2>/dev/null || true

    echo ""
}

run_unit_tests() {
    echo "------------------------------------------"
    echo "Running Unit Tests (Python)"
    echo "------------------------------------------"

    cd "$PROJECT_DIR"
    python -m pytest tests/ -v --tb=short

    echo ""

    echo "------------------------------------------"
    echo "Running Unit Tests (JavaScript)"
    echo "------------------------------------------"

    cd "$PROJECT_DIR/js"
    npm test

    echo ""

    echo "------------------------------------------"
    echo "Running Unit Tests (TypeScript)"
    echo "------------------------------------------"

    cd "$PROJECT_DIR/ts"
    npm test

    echo ""
}

# Main
check_deps

case "${1:-all}" in
    python)
        run_python_e2e
        ;;
    js)
        run_js_e2e
        ;;
    unit)
        run_unit_tests
        ;;
    e2e)
        run_python_e2e
        run_js_e2e
        ;;
    all)
        run_unit_tests
        run_python_e2e
        run_js_e2e
        ;;
    *)
        echo "Usage: $0 [python|js|unit|e2e|all]"
        echo ""
        echo "  python  - Run Python E2E tests only"
        echo "  js      - Run JavaScript E2E tests only"
        echo "  unit    - Run unit tests only (Python, JS, TS)"
        echo "  e2e     - Run all E2E tests"
        echo "  all     - Run all tests (default)"
        exit 1
        ;;
esac

echo "=========================================="
echo "All tests completed!"
echo "=========================================="

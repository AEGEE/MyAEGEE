#!/bin/bash
# Performance validation script for dev container
# Tests against specifications: SC-004, SC-005, SC-009

set -e

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Print header
print_header() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║         MyAEGEE Dev Container Performance Tests            ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

# Test result tracking
pass_test() {
    local test_name="$1"
    echo -e "${GREEN}✓ PASS${NC} - $test_name"
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
}

fail_test() {
    local test_name="$1"
    local details="$2"
    echo -e "${RED}✗ FAIL${NC} - $test_name"
    if [ -n "$details" ]; then
        echo -e "  ${YELLOW}Details:${NC} $details"
    fi
    ((TESTS_FAILED++))
    ((TESTS_TOTAL++))
}

skip_test() {
    local test_name="$1"
    local reason="$2"
    echo -e "${BLUE}⊘ SKIP${NC} - $test_name"
    if [ -n "$reason" ]; then
        echo -e "  ${YELLOW}Reason:${NC} $reason"
    fi
    ((TESTS_TOTAL++))
}

# Test 1: Startup Timing (SC-004)
# Requirement: Services healthy within 2 minutes
test_startup_timing() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "Test 1: Startup Timing (SC-004: <2 minutes)"
    echo "═══════════════════════════════════════════════════════════"
    
    log_info "Stopping all services..."
    make -C /workspace stop > /dev/null 2>&1 || true
    sleep 3
    
    log_info "Starting services and measuring time..."
    START_TIME=$(date +%s)
    
    # Start services
    make -C /workspace start > /dev/null 2>&1
    
    # Wait for services to be healthy
    log_info "Waiting for services to become healthy..."
    sleep 10  # Initial wait for containers to start
    
    # Source health check functions
    source "$SCRIPT_DIR/health-check.sh"
    
    # Wait for services (with timeout)
    TIMEOUT=180  # 3 minutes max
    ELAPSED=0
    ALL_HEALTHY=false
    
    while [ $ELAPSED -lt $TIMEOUT ]; do
        if check_all_services_healthy > /dev/null 2>&1; then
            ALL_HEALTHY=true
            break
        fi
        sleep 5
        ELAPSED=$(($(date +%s) - START_TIME))
    done
    
    END_TIME=$(date +%s)
    TOTAL_TIME=$((END_TIME - START_TIME))
    
    echo ""
    echo "Startup time: ${TOTAL_TIME}s (${TOTAL_TIME} seconds)"
    
    if [ "$ALL_HEALTHY" = true ] && [ $TOTAL_TIME -le 120 ]; then
        pass_test "Startup timing: ${TOTAL_TIME}s ≤ 120s target"
    elif [ "$ALL_HEALTHY" = true ] && [ $TOTAL_TIME -le 180 ]; then
        fail_test "Startup timing: ${TOTAL_TIME}s > 120s target (acceptable: ≤180s)" \
                  "Services started but slower than spec"
    elif [ "$ALL_HEALTHY" = true ]; then
        fail_test "Startup timing: ${TOTAL_TIME}s > 180s" \
                  "Services started but significantly slower than spec"
    else
        fail_test "Startup timing: Services failed to become healthy within ${TIMEOUT}s" \
                  "Check service logs: make monitor"
    fi
}

# Test 2: Hot Reload (SC-005)
# Requirement: Code changes visible within 3 seconds
test_hot_reload() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "Test 2: Hot Reload (SC-005: <3 seconds)"
    echo "═══════════════════════════════════════════════════════════"
    
    # Check if frontend is running
    if ! docker ps | grep -q myaegee_frontend; then
        skip_test "Hot reload test" "Frontend not running"
        return
    fi
    
    log_info "Testing hot reload by modifying frontend file..."
    
    # Create a temporary test file
    TEST_FILE="/workspace/frontend/src/test-hot-reload-$$.txt"
    TIMESTAMP=$(date +%s%N)
    
    # Record start time
    START_TIME=$(date +%s)
    
    # Create test file
    echo "Hot reload test: $TIMESTAMP" > "$TEST_FILE"
    
    # Wait a moment for file system event
    sleep 1
    
    # Check if webpack/vite detected the change
    # Look for rebuild in logs
    REBUILD_DETECTED=false
    for i in {1..5}; do
        if docker logs myaegee_frontend_1 --tail=50 2>&1 | grep -qE "(Compiled|built|Bundle complete)"; then
            REBUILD_DETECTED=true
            break
        fi
        sleep 0.5
    done
    
    END_TIME=$(date +%s)
    RELOAD_TIME=$((END_TIME - START_TIME))
    
    # Clean up
    rm -f "$TEST_FILE"
    
    echo ""
    echo "Hot reload detection time: ${RELOAD_TIME}s"
    
    if [ "$REBUILD_DETECTED" = true ] && [ $RELOAD_TIME -le 3 ]; then
        pass_test "Hot reload: ${RELOAD_TIME}s ≤ 3s target"
    elif [ "$REBUILD_DETECTED" = true ]; then
        fail_test "Hot reload: ${RELOAD_TIME}s > 3s target" \
                  "Rebuild detected but slower than spec"
    else
        skip_test "Hot reload test" "Could not verify rebuild in logs (check manually)"
    fi
}

# Test 3: Full Mode Memory (SC-009)
# Requirement: <4GB RAM for full mode
test_full_mode_memory() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "Test 3: Full Mode Memory (SC-009: <4GB RAM)"
    echo "═══════════════════════════════════════════════════════════"
    
    log_info "Starting all services in full mode..."
    
    # Ensure all services are enabled
    export ENABLED_SERVICES=""
    make -C /workspace stop > /dev/null 2>&1 || true
    sleep 3
    make -C /workspace start > /dev/null 2>&1
    sleep 30  # Wait for services to stabilize
    
    log_info "Measuring memory usage..."
    
    # Get memory usage of all MyAEGEE containers
    TOTAL_MEM_KB=0
    
    # Read docker stats (one-time snapshot)
    while IFS= read -r line; do
        # Extract memory usage in MB or GB
        MEM=$(echo "$line" | awk '{print $4}')
        
        # Convert to KB for consistent calculation
        if echo "$MEM" | grep -q "GiB"; then
            MEM_KB=$(echo "$MEM" | sed 's/GiB//' | awk '{printf "%.0f", $1 * 1024 * 1024}')
        elif echo "$MEM" | grep -q "MiB"; then
            MEM_KB=$(echo "$MEM" | sed 's/MiB//' | awk '{printf "%.0f", $1 * 1024}')
        elif echo "$MEM" | grep -q "KiB"; then
            MEM_KB=$(echo "$MEM" | sed 's/KiB//' | awk '{printf "%.0f", $1}')
        else
            MEM_KB=0
        fi
        
        TOTAL_MEM_KB=$((TOTAL_MEM_KB + MEM_KB))
    done < <(docker stats --no-stream --format "{{.Container}} {{.MemUsage}}" | grep myaegee | awk '{print $1, $2}')
    
    # Convert to MB and GB for display
    TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))
    TOTAL_MEM_GB=$(awk "BEGIN {printf \"%.2f\", $TOTAL_MEM_MB / 1024}")
    
    echo ""
    echo "Total memory usage: ${TOTAL_MEM_MB}MB (${TOTAL_MEM_GB}GB)"
    
    # Check against 4GB limit (4096MB)
    if [ $TOTAL_MEM_MB -le 4096 ]; then
        pass_test "Full mode memory: ${TOTAL_MEM_GB}GB ≤ 4GB target"
    else
        fail_test "Full mode memory: ${TOTAL_MEM_GB}GB > 4GB target" \
                  "Memory usage exceeds specification"
    fi
    
    # Show breakdown by service
    echo ""
    echo "Memory breakdown by service:"
    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | grep myaegee || true
}

# Test 4: Minimal Mode Memory (SC-009)
# Requirement: <2GB RAM for minimal mode
test_minimal_mode_memory() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "Test 4: Minimal Mode Memory (SC-009: <2GB RAM)"
    echo "═══════════════════════════════════════════════════════════"
    
    log_info "Switching to minimal mode (core + frontend only)..."
    
    # Set minimal mode
    export ENABLED_SERVICES="core:frontend"
    make -C /workspace stop > /dev/null 2>&1 || true
    sleep 3
    make -C /workspace start > /dev/null 2>&1
    sleep 30  # Wait for services to stabilize
    
    log_info "Measuring memory usage..."
    
    # Get memory usage of all MyAEGEE containers
    TOTAL_MEM_KB=0
    
    while IFS= read -r line; do
        MEM=$(echo "$line" | awk '{print $4}')
        
        if echo "$MEM" | grep -q "GiB"; then
            MEM_KB=$(echo "$MEM" | sed 's/GiB//' | awk '{printf "%.0f", $1 * 1024 * 1024}')
        elif echo "$MEM" | grep -q "MiB"; then
            MEM_KB=$(echo "$MEM" | sed 's/MiB//' | awk '{printf "%.0f", $1 * 1024}')
        elif echo "$MEM" | grep -q "KiB"; then
            MEM_KB=$(echo "$MEM" | sed 's/KiB//' | awk '{printf "%.0f", $1}')
        else
            MEM_KB=0
        fi
        
        TOTAL_MEM_KB=$((TOTAL_MEM_KB + MEM_KB))
    done < <(docker stats --no-stream --format "{{.Container}} {{.MemUsage}}" | grep myaegee | awk '{print $1, $2}')
    
    TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))
    TOTAL_MEM_GB=$(awk "BEGIN {printf \"%.2f\", $TOTAL_MEM_MB / 1024}")
    
    echo ""
    echo "Total memory usage: ${TOTAL_MEM_MB}MB (${TOTAL_MEM_GB}GB)"
    
    # Check against 2GB limit (2048MB)
    if [ $TOTAL_MEM_MB -le 2048 ]; then
        pass_test "Minimal mode memory: ${TOTAL_MEM_GB}GB ≤ 2GB target"
    else
        fail_test "Minimal mode memory: ${TOTAL_MEM_GB}GB > 2GB target" \
                  "Memory usage exceeds specification"
    fi
    
    # Show breakdown
    echo ""
    echo "Memory breakdown by service:"
    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | grep myaegee || true
}

# Print summary
print_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "Test Summary"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Total tests: $TESTS_TOTAL"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo -e "Skipped: $((TESTS_TOTAL - TESTS_PASSED - TESTS_FAILED))"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                        ║${NC}"
        echo -e "${GREEN}║   ✓ ALL TESTS PASSED!                  ║${NC}"
        echo -e "${GREEN}║                                        ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
        return 0
    else
        echo -e "${RED}╔════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                                        ║${NC}"
        echo -e "${RED}║   ✗ SOME TESTS FAILED                  ║${NC}"
        echo -e "${RED}║                                        ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════╝${NC}"
        echo ""
        echo "See above for details. Common fixes:"
        echo "  • Increase Docker memory allocation"
        echo "  • Close memory-intensive applications"
        echo "  • Optimize service resource usage"
        echo "  • Check docker stats for high memory consumers"
        return 1
    fi
}

# Main execution
main() {
    print_header
    
    # Check prerequisites
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Cannot run performance tests."
        exit 1
    fi
    
    if ! docker ps &> /dev/null; then
        log_error "Docker daemon not accessible. Is Docker running?"
        exit 1
    fi
    
    log_success "Prerequisites OK"
    
    # Allow user to select tests
    if [ "$1" = "--all" ] || [ -z "$1" ]; then
        test_startup_timing
        test_hot_reload
        test_full_mode_memory
        test_minimal_mode_memory
    else
        case "$1" in
            startup)
                test_startup_timing
                ;;
            hot-reload)
                test_hot_reload
                ;;
            full-memory)
                test_full_mode_memory
                ;;
            minimal-memory)
                test_minimal_mode_memory
                ;;
            *)
                echo "Usage: $0 [--all|startup|hot-reload|full-memory|minimal-memory]"
                exit 1
                ;;
        esac
    fi
    
    print_summary
}

# Run main with arguments
main "$@"

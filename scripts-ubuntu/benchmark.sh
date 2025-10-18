#!/bin/bash
# Performance benchmarking script for MyAEGEE
# Measures setup time, memory usage, startup performance, and hot reload speed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

BENCHMARK_RESULTS="${REPO_ROOT}/benchmark-results-$(date +%Y%m%d-%H%M%S).txt"

print_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║            MyAEGEE Performance Benchmark                 ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
}

log_result() {
    local message=$1
    echo "$message" | tee -a "$BENCHMARK_RESULTS"
}

benchmark_system_info() {
    log_step "System Information"
    
    log_result "=== System Information ==="
    log_result "Date: $(date)"
    log_result "OS: $(lsb_release -d | cut -f2)"
    log_result "Kernel: $(uname -r)"
    log_result "CPU: $(lscpu | grep "Model name" | cut -d: -f2 | xargs)"
    log_result "CPU Cores: $(nproc)"
    log_result "Total RAM: $(free -h | grep Mem | awk '{print $2}')"
    log_result "Free RAM: $(free -h | grep Mem | awk '{print $7}')"
    log_result "Disk (root): $(df -h / | tail -1 | awk '{print $2 " total, " $4 " free"}')"
    log_result "Docker Version: $(docker --version)"
    log_result "Docker Compose: $(docker compose version)"
    
    if is_vagrant; then
        log_result "Environment: Vagrant"
    else
        log_result "Environment: Direct Docker"
    fi
    
    log_result ""
}

benchmark_container_startup() {
    log_step "Container Startup Performance"
    
    log_info "Stopping all containers..."
    make stop >/dev/null 2>&1 || true
    
    log_info "Starting containers and measuring time..."
    local start_time=$(date +%s)
    
    make start >/dev/null 2>&1
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_result "=== Container Startup ==="
    log_result "Time to start all containers: ${duration} seconds"
    
    # Wait for containers to be fully ready
    sleep 10
    
    # Count running containers
    local container_count=$(docker ps --format "{{.Names}}" | wc -l)
    log_result "Running containers: ${container_count}"
    log_result ""
}

benchmark_memory_usage() {
    log_step "Memory Usage"
    
    log_info "Measuring memory consumption..."
    sleep 5  # Let containers stabilize
    
    local total_mem=$(free -m | grep Mem | awk '{print $2}')
    local used_mem=$(free -m | grep Mem | awk '{print $3}')
    local free_mem=$(free -m | grep Mem | awk '{print $4}')
    local available_mem=$(free -m | grep Mem | awk '{print $7}')
    
    log_result "=== Memory Usage ==="
    log_result "Total: ${total_mem} MB"
    log_result "Used: ${used_mem} MB"
    log_result "Free: ${free_mem} MB"
    log_result "Available: ${available_mem} MB"
    log_result "Usage: $((used_mem * 100 / total_mem))%"
    log_result ""
    
    # Docker-specific memory
    log_result "=== Docker Container Memory ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | tee -a "$BENCHMARK_RESULTS"
    log_result ""
}

benchmark_hot_reload() {
    log_step "Hot Reload Performance"
    
    log_info "Testing hot reload speed..."
    
    # Test with core service
    local test_file="${REPO_ROOT}/core/lib/server.js"
    
    if [ ! -f "$test_file" ]; then
        log_warning "Test file not found, skipping hot reload test"
        return
    fi
    
    log_info "Modifying file: ${test_file}"
    
    # Add a comment
    echo "// Benchmark test $(date +%s)" >> "$test_file"
    
    local start_time=$(date +%s.%N)
    
    # Wait for restart message in logs
    local max_wait=30
    local waited=0
    local restarted=false
    
    while [ $waited -lt $max_wait ]; do
        if docker logs --tail 50 oms-core 2>&1 | grep -q "restart\|restarting\|reloading"; then
            restarted=true
            break
        fi
        sleep 0.5
        waited=$((waited + 1))
    done
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    # Restore file
    git checkout "$test_file" 2>/dev/null || true
    
    log_result "=== Hot Reload Performance ==="
    if [ "$restarted" = true ]; then
        log_result "Hot reload time: ${duration} seconds"
        
        if (( $(echo "$duration < 3" | bc -l) )); then
            log_result "Status: ✅ Excellent (<3s)"
        elif (( $(echo "$duration < 5" | bc -l) )); then
            log_result "Status: ✅ Good (3-5s)"
        else
            log_result "Status: ⚠️  Slow (>5s)"
        fi
    else
        log_result "Hot reload: ❌ Not detected within ${max_wait}s"
        log_result "This may indicate an issue with file watching"
    fi
    log_result ""
}

benchmark_disk_io() {
    log_step "Disk I/O Performance"
    
    log_info "Testing disk I/O..."
    
    # Create temporary test file
    local test_file="${REPO_ROOT}/.benchmark-test-file"
    local test_size_mb=100
    
    # Write test
    log_info "Testing write speed (${test_size_mb}MB)..."
    local write_start=$(date +%s.%N)
    dd if=/dev/zero of="$test_file" bs=1M count=$test_size_mb 2>/dev/null
    sync
    local write_end=$(date +%s.%N)
    local write_duration=$(echo "$write_end - $write_start" | bc)
    local write_speed=$(echo "$test_size_mb / $write_duration" | bc)
    
    # Read test
    log_info "Testing read speed (${test_size_mb}MB)..."
    # Clear cache
    sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches' 2>/dev/null || true
    local read_start=$(date +%s.%N)
    dd if="$test_file" of=/dev/null bs=1M 2>/dev/null
    local read_end=$(date +%s.%N)
    local read_duration=$(echo "$read_end - $read_start" | bc)
    local read_speed=$(echo "$test_size_mb / $read_duration" | bc)
    
    # Cleanup
    rm -f "$test_file"
    
    log_result "=== Disk I/O Performance ==="
    log_result "Write speed: ${write_speed} MB/s"
    log_result "Read speed: ${read_speed} MB/s"
    log_result ""
}

benchmark_response_time() {
    log_step "HTTP Response Time"
    
    log_info "Testing HTTP response times..."
    
    # Wait for services to be fully ready
    sleep 5
    
    # Test frontend
    if curl -s -o /dev/null -w '' http://my.appserver.test 2>/dev/null; then
        local frontend_time=$(curl -s -o /dev/null -w '%{time_total}' http://my.appserver.test 2>/dev/null || echo "N/A")
        log_result "=== HTTP Response Times ==="
        log_result "Frontend (http://my.appserver.test): ${frontend_time}s"
    else
        log_result "=== HTTP Response Times ==="
        log_result "Frontend: ❌ Not accessible"
    fi
    
    # Test Traefik dashboard
    if curl -s -o /dev/null -w '' http://traefik.appserver.test 2>/dev/null; then
        local traefik_time=$(curl -s -o /dev/null -w '%{time_total}' http://traefik.appserver.test 2>/dev/null || echo "N/A")
        log_result "Traefik Dashboard: ${traefik_time}s"
    else
        log_result "Traefik Dashboard: ❌ Not accessible"
    fi
    
    log_result ""
}

benchmark_docker_stats() {
    log_step "Docker System Stats"
    
    log_result "=== Docker System Usage ==="
    docker system df | tee -a "$BENCHMARK_RESULTS"
    log_result ""
}

print_summary() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║              Benchmark Complete!                         ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    log_success "Results saved to: ${BENCHMARK_RESULTS}"
    echo ""
    log_info "Key Metrics:"
    
    # Extract key metrics from results
    if is_vagrant; then
        log_info "  Environment: Vagrant + VirtualBox"
    else
        log_info "  Environment: Direct Docker on Ubuntu"
    fi
    
    grep "Time to start" "$BENCHMARK_RESULTS" | sed 's/^/  /'
    grep "Running containers" "$BENCHMARK_RESULTS" | sed 's/^/  /'
    grep "Usage:" "$BENCHMARK_RESULTS" | sed 's/^/  Memory /'
    grep "Hot reload time" "$BENCHMARK_RESULTS" | sed 's/^/  /' || echo "  Hot reload: Not tested"
    
    echo ""
}

# Main benchmark workflow
main() {
    print_banner
    
    log_info "This benchmark will measure:"
    log_info "  • System information"
    log_info "  • Container startup time"
    log_info "  • Memory usage"
    log_info "  • Hot reload performance"
    log_info "  • Disk I/O speed"
    log_info "  • HTTP response times"
    log_info "  • Docker resource usage"
    echo ""
    
    log_warning "Note: This will restart your containers"
    echo ""
    
    if ! confirm "Do you want to continue?"; then
        log_info "Benchmark cancelled"
        exit 0
    fi
    
    echo ""
    
    # Initialize results file
    echo "MyAEGEE Performance Benchmark" > "$BENCHMARK_RESULTS"
    echo "=============================" >> "$BENCHMARK_RESULTS"
    echo "" >> "$BENCHMARK_RESULTS"
    
    # Run benchmarks
    benchmark_system_info
    benchmark_container_startup
    benchmark_memory_usage
    benchmark_hot_reload
    benchmark_disk_io
    benchmark_response_time
    benchmark_docker_stats
    
    print_summary
    
    exit 0
}

# Run main function
main "$@"

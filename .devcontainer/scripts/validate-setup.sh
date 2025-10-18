#!/bin/bash
# Validation script to check prerequisites before starting dev container
# Tests: Docker version, RAM, disk space, and other requirements

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check results
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Print header
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║         MyAEGEE Dev Container - Prerequisites Check        ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC} - $1"
    ((CHECKS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC} - $1"
    if [ -n "$2" ]; then
        echo -e "  ${YELLOW}→${NC} $2"
    fi
    ((CHECKS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC} - $1"
    if [ -n "$2" ]; then
        echo -e "  ${YELLOW}→${NC} $2"
    fi
    ((CHECKS_WARNING++))
}

info() {
    echo -e "${BLUE}ℹ INFO${NC} - $1"
}

section() {
    echo ""
    echo "─────────────────────────────────────────────────────────────"
    echo "$1"
    echo "─────────────────────────────────────────────────────────────"
}

# Get available RAM in GB
get_ram_gb() {
    if [ -f /proc/meminfo ]; then
        # Linux
        local mem_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        echo $((mem_kb / 1024 / 1024))
    elif command -v vm_stat &> /dev/null; then
        # macOS
        local free_pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.')
        local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
        echo $(( (free_pages * page_size) / 1024 / 1024 / 1024 ))
    else
        echo 0
    fi
}

# Get available disk space in GB
get_disk_gb() {
    df -BG /var/lib/docker 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo 0
}

# Check 1: Docker availability
section "Check 1: Docker Installation"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    DOCKER_MAJOR=$(echo "$DOCKER_VERSION" | cut -d. -f1)
    DOCKER_MINOR=$(echo "$DOCKER_VERSION" | cut -d. -f2)
    
    if [ "$DOCKER_MAJOR" -gt 20 ] || ([ "$DOCKER_MAJOR" -eq 20 ] && [ "$DOCKER_MINOR" -ge 10 ]); then
        pass "Docker $DOCKER_VERSION installed (required: ≥20.10)"
    else
        fail "Docker $DOCKER_VERSION is too old (required: ≥20.10)" \
             "Update Docker: https://docs.docker.com/engine/install/"
    fi
else
    fail "Docker not found" \
         "Install Docker: https://docs.docker.com/get-docker/"
fi

# Check 2: Docker daemon running
section "Check 2: Docker Daemon"

if docker ps &> /dev/null; then
    pass "Docker daemon is running and accessible"
else
    fail "Docker daemon not accessible" \
         "Start Docker Desktop or run: sudo systemctl start docker"
fi

# Check 3: Docker Compose
section "Check 3: Docker Compose"

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    pass "Docker Compose $COMPOSE_VERSION installed (standalone)"
elif docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version --short)
    pass "Docker Compose $COMPOSE_VERSION installed (plugin)"
else
    fail "Docker Compose not found" \
         "Install: https://docs.docker.com/compose/install/"
fi

# Check 4: Available RAM
section "Check 4: Available RAM"

RAM_GB=$(get_ram_gb)
info "Available RAM: ${RAM_GB}GB"

if [ "$RAM_GB" -ge 8 ]; then
    pass "RAM: ${RAM_GB}GB (recommended: ≥8GB)"
elif [ "$RAM_GB" -ge 4 ]; then
    warn "RAM: ${RAM_GB}GB (minimum met, but <8GB recommended)" \
         "Consider using minimal mode or increasing Docker memory allocation"
else
    fail "RAM: ${RAM_GB}GB (minimum: 4GB required)" \
         "Increase Docker Desktop memory allocation or close other applications"
fi

# Check 5: Disk Space
section "Check 5: Disk Space"

DISK_GB=$(get_disk_gb)
if [ "$DISK_GB" -gt 0 ]; then
    info "Available disk space: ${DISK_GB}GB"
    
    if [ "$DISK_GB" -ge 20 ]; then
        pass "Disk space: ${DISK_GB}GB (recommended: ≥20GB)"
    elif [ "$DISK_GB" -ge 10 ]; then
        warn "Disk space: ${DISK_GB}GB (minimum met, but <20GB recommended)" \
             "Consider cleaning up: docker system prune -af"
    else
        fail "Disk space: ${DISK_GB}GB (minimum: 10GB required)" \
             "Free up space or clean Docker: docker system prune -af --volumes"
    fi
else
    warn "Could not determine disk space" \
         "Manually verify: df -h"
fi

# Check 6: Git
section "Check 6: Git Installation"

if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | grep -oP '\d+\.\d+\.\d+')
    pass "Git $GIT_VERSION installed"
else
    fail "Git not found" \
         "Install: https://git-scm.com/downloads"
fi

# Check 7: VS Code
section "Check 7: VS Code (if running locally)"

if command -v code &> /dev/null; then
    CODE_VERSION=$(code --version 2>/dev/null | head -1 || echo "unknown")
    pass "VS Code installed (version: $CODE_VERSION)"
else
    info "VS Code command not found (OK if running in Codespaces)"
fi

# Check 8: Dev Containers extension (VS Code)
section "Check 8: Dev Containers Extension"

if [ -n "$REMOTE_CONTAINERS" ] || [ -n "$CODESPACES" ]; then
    pass "Running in dev container environment"
else
    info "Not currently in a dev container"
    info "Install extension: ms-vscode-remote.remote-containers"
fi

# Check 9: Node.js (if running in container)
section "Check 9: Node.js (if in container)"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo "$NODE_VERSION" | grep -oP '\d+' | head -1)
    
    if [ "$NODE_MAJOR" -ge 18 ]; then
        pass "Node.js $NODE_VERSION (required: ≥18.x)"
    else
        warn "Node.js $NODE_VERSION (recommended: ≥18.x LTS)" \
             "Update recommended for best compatibility"
    fi
else
    info "Node.js not found (will be installed in container)"
fi

# Check 10: Port availability
section "Check 10: Port Availability"

REQUIRED_PORTS=(3000 8080 8084 8085 8086 8087 8088 8089 8090 8091 8092 9000 5050)
PORTS_IN_USE=0

for port in "${REQUIRED_PORTS[@]}"; do
    if command -v lsof &> /dev/null; then
        if lsof -i ":$port" &> /dev/null; then
            warn "Port $port is in use" \
                 "Stop conflicting service or change port in devcontainer.json"
            ((PORTS_IN_USE++))
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            warn "Port $port is in use" \
                 "Stop conflicting service or change port in devcontainer.json"
            ((PORTS_IN_USE++))
        fi
    fi
done

if [ $PORTS_IN_USE -eq 0 ]; then
    pass "All required ports are available"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Validation Summary"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}║   ✓ Prerequisites Met!                 ║${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "You're ready to start the dev container!"
    echo ""
    echo "Next steps:"
    echo "1. Open repository in VS Code"
    echo "2. Command Palette → 'Dev Containers: Reopen in Container'"
    echo "3. Wait for container to build and start"
    echo ""
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                        ║${NC}"
    echo -e "${RED}║   ✗ Prerequisites Not Met              ║${NC}"
    echo -e "${RED}║                                        ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Please fix the failed checks above before starting."
    echo ""
    echo "Common fixes:"
    echo "  • Install/update Docker: https://docs.docker.com/get-docker/"
    echo "  • Start Docker daemon: Docker Desktop or 'sudo systemctl start docker'"
    echo "  • Increase Docker resources: Settings → Resources"
    echo "  • Free disk space: docker system prune -af"
    echo ""
    exit 1
fi

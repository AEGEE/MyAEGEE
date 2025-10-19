#!/bin/bash
# Post-start script - Runs every time the container starts

set -e

# Start timing
START_TIME=$(date +%s)

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/health-check.sh"

# Display startup banner
clear
cat << 'BANNER'
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║              🌍  MyAEGEE Development Environment  🌍                  ║
║                                                                       ║
║           AEGEE-Europe Online Membership System (OMS)                ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
BANNER

echo ""
log_info "Container started at $(date)"
echo ""

# Detect environment
if [ -n "$CODESPACES" ]; then
    ENV_TYPE="GitHub Codespaces"
    log_info "Running in: $ENV_TYPE"
    log_info "Codespace name: $CODESPACE_NAME"
elif [ -n "$REMOTE_CONTAINERS" ]; then
    ENV_TYPE="VS Code Dev Containers (Local)"
    log_info "Running in: $ENV_TYPE"
else
    ENV_TYPE="Unknown"
    log_info "Running in: $ENV_TYPE"
fi

# Check available RAM
AVAILABLE_RAM=$(get_available_ram_gb)
log_info "Available RAM: ${AVAILABLE_RAM}GB"

# Display seed profile
if [ -f /workspace/.devcontainer/.env.devcontainer ]; then
    SEED_PROFILE=$(grep "^SEED_PROFILE=" /workspace/.devcontainer/.env.devcontainer | cut -d'=' -f2 || echo "default")
    log_info "Database seed profile: ${SEED_PROFILE}"
fi

# Check if ENABLED_SERVICES is already set (from .env or environment)
if [ -z "$ENABLED_SERVICES" ]; then
    # Load from .env file if exists
    if [ -f /workspace/.env ]; then
        ENABLED_SERVICES=$(grep "^ENABLED_SERVICES=" /workspace/.env | cut -d'=' -f2)
    fi
fi

# Minimal mode prompt for limited RAM
if [ "$AVAILABLE_RAM" -lt 6 ] && [ "$AVAILABLE_RAM" -ge 4 ]; then
    log_warning "Limited RAM detected (${AVAILABLE_RAM}GB available)"

    # Only prompt if ENABLED_SERVICES is not already set
    if [ -z "$ENABLED_SERVICES" ]; then
        echo ""
        echo "╔═══════════════════════════════════════════════════════════════════════╗"
        echo "║                     🚀 Minimal Mode Available                         ║"
        echo "╚═══════════════════════════════════════════════════════════════════════╝"
        echo ""
        echo "With ${AVAILABLE_RAM}GB RAM, you can choose between:"
        echo ""
        echo "  1️⃣  FULL MODE (default):"
        echo "      ✅ All 12 services (Core, Events, Statutory, Discounts, etc.)"
        echo "      ⚠️  May be slower with limited RAM"
        echo "      📊 Recommended: 8GB+ RAM"
        echo ""
        echo "  2️⃣  MINIMAL MODE:"
        echo "      ✅ Core essentials only (Core API + Frontend)"
        echo "      ⚡ Faster startup and better performance"
        echo "      💾 Uses ~2GB RAM"
        echo ""
        echo "Would you like to use MINIMAL MODE? [y/N]"
        echo "(Auto-selecting 'N' in 15 seconds...)"
        echo ""

        # Read with timeout
        read -t 15 -r minimal_choice
        minimal_choice=${minimal_choice:-N}

        if [[ "$minimal_choice" =~ ^[Yy]$ ]]; then
            log_success "Minimal mode selected"
            export ENABLED_SERVICES="core:frontend"

            # Save preference to .devcontainer/.env.devcontainer
            if [ -f /workspace/.devcontainer/.env.devcontainer ]; then
                if grep -q "^ENABLED_SERVICES=" /workspace/.devcontainer/.env.devcontainer; then
                    sed -i "s/^ENABLED_SERVICES=.*/ENABLED_SERVICES=core:frontend/" /workspace/.devcontainer/.env.devcontainer
                else
                    echo "ENABLED_SERVICES=core:frontend" >> /workspace/.devcontainer/.env.devcontainer
                fi
            fi
        else
            log_info "Full mode selected - starting all services"
        fi
    else
        log_info "Service configuration: ${ENABLED_SERVICES}"
    fi
elif [ "$AVAILABLE_RAM" -lt 4 ]; then
    log_error "Insufficient RAM (${AVAILABLE_RAM}GB available, minimum 4GB required)"
    log_error "Please increase Docker memory allocation or use a machine with more RAM"
    echo ""
    echo "To increase Docker memory:"
    echo "  - Docker Desktop: Settings → Resources → Memory"
    echo "  - Codespaces: Use a larger machine type"
    echo "  - Close other applications to free up memory"
    echo ""
    exit 1
else
    # Plenty of RAM - load ENABLED_SERVICES if set
    if [ -n "$ENABLED_SERVICES" ]; then
        log_info "Service configuration: ${ENABLED_SERVICES}"
    else
        log_info "Full mode - all services enabled"
    fi
fi

# Display which services are enabled/disabled
if [ -n "$ENABLED_SERVICES" ]; then
    print_section "Service Configuration"

    IFS=':' read -ra ENABLED_ARRAY <<< "$ENABLED_SERVICES"

    echo ""
    echo "✅ ENABLED SERVICES:"
    for service in "${ENABLED_ARRAY[@]}"; do
        echo "   • $service"
    done

    # Show common disabled services if in minimal mode
    if [[ "$ENABLED_SERVICES" == "core:frontend" ]] || [[ "$ENABLED_SERVICES" == "frontend:core" ]]; then
        echo ""
        echo "⏸️  DISABLED SERVICES (minimal mode):"
        echo "   • events, statutory, discounts, knowledge"
        echo "   • summeruniversity, network, mailer, gsuite-wrapper"
        echo ""
        echo "💡 To enable more services, edit .env file:"
        echo "   ENABLED_SERVICES=core:frontend:events:statutory"
        echo "   Then run: make restart"
    fi
    echo ""
fi

print_section "Checking Docker availability"

# Check if Docker socket exists
if [ ! -S /var/run/docker.sock ]; then
    log_error "Docker socket not found at /var/run/docker.sock"
    log_error "This dev container requires Docker to be available"

    if [ -n "$CODESPACES" ]; then
        log_error "GitHub Codespaces should provide Docker automatically"
        log_error "This might be a Codespaces platform issue"
    fi

    exit 1
fi

# Fix Docker socket permissions for Codespaces
# In Codespaces, the Docker socket is mounted from the host and may have a different group ID
# than our container's docker group. We'll use sudo for Docker commands to avoid permission issues.
SOCKET_GROUP=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo "unknown")
DOCKER_GROUP_ID=$(getent group docker | cut -d: -f3 2>/dev/null || echo "unknown")

USE_SUDO_FOR_DOCKER=false
if [ "$SOCKET_GROUP" != "$DOCKER_GROUP_ID" ] && [ "$SOCKET_GROUP" != "unknown" ]; then
    log_info "Docker socket group ($SOCKET_GROUP) differs from container docker group ($DOCKER_GROUP_ID)"
    log_info "Will use sudo for Docker commands to avoid permission issues"
    USE_SUDO_FOR_DOCKER=true
fi

# Test Docker access
log_info "Verifying Docker daemon access..."

DOCKER_TIMEOUT=15
DOCKER_WAIT=0
WAIT_INTERVAL=1

# Function to run docker commands (with or without sudo)
docker_cmd() {
    if [ "$USE_SUDO_FOR_DOCKER" = true ]; then
        sudo docker "$@"
    else
        docker "$@"
    fi
}

while true; do
    # Try docker info
    if docker_cmd info > /dev/null 2>&1; then
        break
    fi

    # Check timeout
    if [ $DOCKER_WAIT -ge $DOCKER_TIMEOUT ]; then
        log_error "Docker daemon is not responding after ${DOCKER_TIMEOUT}s"

        echo ""
        echo "Diagnostic information:"
        echo "  Docker socket: $(ls -l /var/run/docker.sock 2>&1)"
        echo "  Socket group: $SOCKET_GROUP"
        echo "  Container docker group: $DOCKER_GROUP_ID"
        echo "  Current user: $(whoami)"
        echo "  User groups: $(groups)"
        echo ""

        if [ -n "$CODESPACES" ]; then
            log_error "Docker should be available in Codespaces"
            echo "Try: Rebuild the container"
        else
            echo "Try: Ensure Docker Desktop is running"
        fi

        exit 1
    fi

    # Progress indicator
    if [ $((DOCKER_WAIT % 5)) -eq 0 ] && [ $DOCKER_WAIT -gt 0 ]; then
        log_info "Waiting for Docker... (${DOCKER_WAIT}s elapsed)"
    fi

    sleep $WAIT_INTERVAL
    DOCKER_WAIT=$((DOCKER_WAIT + WAIT_INTERVAL))
done

if [ "$USE_SUDO_FOR_DOCKER" = true ]; then
    log_success "Docker is accessible (using sudo)"
else
    log_success "Docker is accessible"
fi

# Check if OMS network exists, create if not
if ! docker_cmd network inspect OMS > /dev/null 2>&1; then
    log_info "Creating OMS Docker network..."
    docker_cmd network create OMS
    log_success "OMS network created"
else
    log_success "OMS network exists"
fi

# Check for port conflicts
print_section "Checking for port conflicts"

check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        log_warning "Port $port ($service) is already in use"
        log_info "Process using port: $(lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | tail -n 1)"
        return 1
    else
        return 0
    fi
}

PORTS_OK=true
for port_info in "3000:Frontend" "8080:Traefik" "8084:Core API" "9000:Portainer" "5050:pgAdmin"; do
    IFS=':' read -r port name <<< "$port_info"
    check_port "$port" "$name" || PORTS_OK=false
done

if [ "$PORTS_OK" = false ]; then
    log_warning "Some ports are already in use. Services may fail to start."
    log_info "You can stop conflicting services or remap ports in devcontainer.json"
    echo ""
fi

print_section "Starting MyAEGEE services"

log_info "[1/3] Starting databases..."
log_info "Services will start using the existing helper.sh infrastructure"
log_info "This preserves all existing Vagrant compatibility"

# Initialize if needed (creates .init file and sets up secrets)
if [ ! -f /workspace/.init ]; then
    log_info "First-time setup detected, initializing..."
    cd /workspace
    make init 2>&1 | tee /tmp/make-init.log || true
    log_success "Initialization complete"
fi

# Start services using existing infrastructure
log_info "[2/3] Starting backend services and frontend..."
cd /workspace

# Check if services are already running
RUNNING_SERVICES=$(docker_cmd ps --format '{{.Names}}' | grep -c 'myaegee' || true)

if [ "$RUNNING_SERVICES" -gt 5 ]; then
    log_success "Services are already running ($RUNNING_SERVICES containers)"
else
    log_info "Starting services (this may take a few minutes on first run)..."

    # Start services in background
    make start > /tmp/make-start.log 2>&1 &
    START_PID=$!

    # Show progress
    echo -n "Starting"
    for i in {1..30}; do
        if ! ps -p $START_PID > /dev/null 2>&1; then
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""

    # Wait a bit for services to initialize
    sleep 10

    log_success "Services started"
fi

log_info "[3/3] Verifying service health..."

# Wait a bit for health checks to stabilize
sleep 5

# Display service status
display_service_status

print_section "Service Access URLs"

echo ""
echo "🌐  MAIN APPLICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$CODESPACES" ]; then
    # Codespaces URLs
    log_info "GitHub Codespaces detected - use port forwarding URLs:"
    echo "  Frontend:  https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    echo "  Traefik:   https://${CODESPACE_NAME}-8080.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    echo ""
    echo "  Check the 'PORTS' tab in VS Code for all forwarded URLs"
else
    # Local URLs
    echo "  Frontend:       http://localhost:3000"
    echo "  Traefik Dashboard: http://localhost:8080"
fi

echo ""
echo "🔧  ADMIN TOOLS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$CODESPACES" ]; then
    echo "  Portainer:  https://${CODESPACE_NAME}-9000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    echo "  pgAdmin:    https://${CODESPACE_NAME}-5050.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
else
    echo "  Portainer:  http://localhost:9000"
    echo "  pgAdmin:    http://localhost:5050"
fi

echo ""
echo "🔌  BACKEND APIs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$CODESPACES" ]; then
    echo "  Check PORTS tab for API endpoints (8084-8092)"
else
    echo "  Core API:          http://localhost:8084"
    echo "  Events API:        http://localhost:8085"
    echo "  Statutory API:     http://localhost:8086"
    echo "  Discounts API:     http://localhost:8087"
    echo "  Knowledge API:     http://localhost:8088"
    echo "  Summer Uni API:    http://localhost:8089"
    echo "  Network API:       http://localhost:8090"
    echo "  Mailer API:        http://localhost:8091"
    echo "  GSuite Wrapper:    http://localhost:8092"
fi

print_section "Quick Commands Reference"

echo ""
echo "📋  COMMON COMMANDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  make start          Start all services"
echo "  make stop           Stop all services"
echo "  make restart        Restart all services"
echo "  make monitor        View logs (Ctrl+C to exit)"
echo "  make list           List running containers"
echo "  make reset-db       Reset databases to seed state"
echo ""
echo "  Type 'alias' to see all available shortcuts!"
echo "  Type 'make help' for more commands"
echo ""

print_header "🎉  Dev Container Ready!"

# Calculate and display startup time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
log_success "All systems operational. Happy coding! 🚀"
echo ""

if [ $MINUTES -gt 0 ]; then
    log_info "⏱️  Startup time: ${MINUTES}m ${SECONDS}s"
else
    log_info "⏱️  Startup time: ${SECONDS}s"
fi

# Performance note based on timing
if [ $ELAPSED -le 120 ]; then
    log_success "✨ Excellent performance! (Target: <2 minutes)"
elif [ $ELAPSED -le 180 ]; then
    log_info "👍 Good performance (within acceptable range)"
else
    log_warning "⏳ Slower than expected. Consider minimal mode for better performance."
fi

echo ""
log_info "Tip: Edit code in your editor - changes will hot-reload automatically"
echo ""
echo ""


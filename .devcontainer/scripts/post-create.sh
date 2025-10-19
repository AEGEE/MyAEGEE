#!/bin/bash
# Post-create script - Runs once after container is created

set -e

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

print_header "MyAEGEE Dev Container - Post-Create Setup"

# Detect platform
detect_platform() {
    if [ -n "$CODESPACES" ]; then
        echo "GitHub Codespaces"
    elif [ -n "$REMOTE_CONTAINERS" ]; then
        echo "VS Code Dev Containers (Local)"
    else
        echo "Unknown"
    fi
}

PLATFORM=$(detect_platform)
log_info "Platform detected: $PLATFORM"

# Detect available RAM
AVAILABLE_RAM=$(get_available_ram_gb)
log_info "Available RAM: ${AVAILABLE_RAM}GB"

# Setup logging
LOG_DIR="/workspace/.devcontainer/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/post-create-$(date +%Y%m%d-%H%M%S).log"

log_info "Logging to: $LOG_FILE"

# Redirect output to log file while still showing on console
exec > >(tee -a "$LOG_FILE")
exec 2>&1

print_section "Verifying prerequisites"

# Check Docker is accessible
if command_exists docker; then
    log_success "Docker CLI is available"
    docker --version
else
    log_error "Docker CLI not found"
    exit 1
fi

# Check docker-compose is accessible
if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
    log_success "Docker Compose is available"
else
    log_error "Docker Compose not found"
    exit 1
fi

# Check Node.js is available
if command_exists node; then
    log_success "Node.js is available: $(node --version)"
else
    log_error "Node.js not found"
    exit 1
fi

# Check npm is available
if command_exists npm; then
    log_success "npm is available: $(npm --version)"
else
    log_error "npm not found"
    exit 1
fi

print_section "Generating development environment configuration"

# Generate .env.devcontainer with localhost URLs
ENV_FILE="/workspace/.env.devcontainer"

log_info "Creating $ENV_FILE..."

cat > "$ENV_FILE" << 'ENVEOF'
# Auto-generated dev container environment configuration
# DO NOT EDIT - This file is regenerated on container creation

BASE_URL=localhost

# Service URLs for dev container (localhost with specific ports)
SUBDOMAIN_FRONTEND=http://localhost:3000
SUBDOMAIN_TRAEFIK=http://localhost:8080
SUBDOMAIN_PORTAINER=http://localhost:9000
SUBDOMAIN_PORTAL=http://localhost:8080
SUBDOMAIN_PGADMIN=http://localhost:5050

# Backend API URLs
SUBDOMAIN_CORE=http://localhost:8084
SUBDOMAIN_EVENTS=http://localhost:8085
SUBDOMAIN_STATUTORY=http://localhost:8086
SUBDOMAIN_DISCOUNTS=http://localhost:8087
SUBDOMAIN_KNOWLEDGE=http://localhost:8088
SUBDOMAIN_SUMMERUNIVERSITY=http://localhost:8089
SUBDOMAIN_NETWORK=http://localhost:8090
SUBDOMAIN_MAILER=http://localhost:8091

# Development mode
MYAEGEE_ENV=development
LOGLEVEL=info

# Database seed profile (default, minimal, or custom)
# default: Full seed data with test users and sample content
# minimal: Essential data only (users and basic structure)
# custom: Define your own seed data
SEED_PROFILE=${SEED_PROFILE:-default}
ENVEOF

log_success "Environment configuration created"

print_section "Setting up shell aliases"

# Create aliases file
ALIASES_FILE="/workspace/.devcontainer/aliases.sh"

cat > "$ALIASES_FILE" << 'ALIASEOF'
# MyAEGEE Development Container Aliases

# Docker shortcuts
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
alias dlogs='docker-compose logs -f --tail=100'
alias dstop='docker-compose stop'
alias drestart='docker-compose restart'

# Make shortcuts
alias mstart='make start'
alias mstop='make stop'
alias mrestart='make restart'
alias mlogs='make monitor'
alias mstatus='make list'

# Helper script shortcuts
alias hstart='./helper.sh --start'
alias hstop='./helper.sh --stop'
alias hrestart='./helper.sh --restart'
alias hlogs='./helper.sh --monitor'
alias hexec='./helper.sh --execute'

# Quick navigation
alias cdcore='cd /workspace/core'
alias cdevents='cd /workspace/events'
alias cdstatutory='cd /workspace/statutory'
alias cdfrontend='cd /workspace/frontend'

# Service health check
alias health='bash /workspace/.devcontainer/scripts/health-check.sh'

echo "MyAEGEE dev container aliases loaded! Type 'alias' to see all available shortcuts."
ALIASEOF

log_success "Shell aliases created"

# Source aliases in bashrc
if ! grep -q "source.*aliases.sh" /home/vscode/.bashrc; then
    echo "" >> /home/vscode/.bashrc
    echo "# MyAEGEE development aliases" >> /home/vscode/.bashrc
    echo "if [ -f /workspace/.devcontainer/aliases.sh ]; then" >> /home/vscode/.bashrc
    echo "    source /workspace/.devcontainer/aliases.sh" >> /home/vscode/.bashrc
    echo "fi" >> /home/vscode/.bashrc
    log_success "Aliases added to .bashrc"
fi

print_section "Setting up shell completion"

# Enable bash completion for docker and docker-compose via docker's built-in generator
# Avoid sourcing /usr/share/bash-completion/completions/docker directly because some images
# ship a non-text file at that path, causing startup errors.
if ! grep -q "docker CLI completion (generated)" /home/vscode/.bashrc; then
    echo "" >> /home/vscode/.bashrc
    echo "# Enable bash completion for Docker CLI (generated)" >> /home/vscode/.bashrc
    echo "# docker CLI completion (generated)" >> /home/vscode/.bashrc
    echo "if command -v docker >/dev/null 2>&1; then" >> /home/vscode/.bashrc
    echo "    source <(docker completion bash)" >> /home/vscode/.bashrc
    echo "fi" >> /home/vscode/.bashrc
    echo "" >> /home/vscode/.bashrc
    echo "# Enable bash completion for Docker Compose V2 (generated, if supported)" >> /home/vscode/.bashrc
    echo "if command -v docker >/dev/null 2>&1; then" >> /home/vscode/.bashrc
    echo "    if docker compose completion bash >/dev/null 2>&1; then" >> /home/vscode/.bashrc
    echo "        source <(docker compose completion bash)" >> /home/vscode/.bashrc
    echo "    fi" >> /home/vscode/.bashrc
    echo "fi" >> /home/vscode/.bashrc
    log_success "Docker and Compose completions added to .bashrc (generated)"
fi

# Note: We still source the global bash_completion in the Dockerfile to enable on-demand loading
# for other tools. The above lines ensure Docker's own completions are always correct.

# Remove any old/broken docker completion sourcing lines to avoid syntax errors like:
# "/usr/share/bash-completion/completions/docker: line 1: syntax error near unexpected token ')'"
sed -i '/\/usr\/share\/bash-completion\/completions\/docker/d' /home/vscode/.bashrc || true
sed -i '/\/usr\/share\/bash-completion\/completions\/docker-compose/d' /home/vscode/.bashrc || true

log_info "Shell completion configured (will be active on next shell session)"

print_section "Post-create setup complete"

log_success "Dev container is ready!"
log_info "Run 'make start' or 'hstart' to start services"

echo ""
print_header "Next Steps"
echo "1. Services will start automatically (configured in post-start.sh)"
echo "2. Access the application at http://localhost:3000"
echo "3. View available commands with 'make help' or 'alias'"
echo ""


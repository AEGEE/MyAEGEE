#!/bin/bash
# MyAEGEE Bootstrap Script for Ubuntu 24.04
# This script sets up Docker and all dependencies for running MyAEGEE directly on Ubuntu

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

# Script paths
CHECK_PREREQ="${SCRIPT_DIR}/check-prerequisites.sh"
INSTALL_DOCKER="${SCRIPT_DIR}/install-docker.sh"
SETUP_PERMISSIONS="${SCRIPT_DIR}/setup-permissions.sh"
SETUP_HOSTS="${SCRIPT_DIR}/setup-hosts.sh"
SETUP_ENV="${SCRIPT_DIR}/setup-environment.sh"
VALIDATE="${SCRIPT_DIR}/validate-installation.sh"

# Track if we need logout
NEED_LOGOUT=false

print_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║        MyAEGEE Direct Docker Setup for Ubuntu 24.04      ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
}

install_system_dependencies() {
    log_step "Step 1/7: Installing System Dependencies"
    
    local missing_packages=()
    
    # Check for required packages
    command_exists git || missing_packages+=("git")
    command_exists make || missing_packages+=("make")
    command_exists curl || missing_packages+=("curl")
    dpkg -l | grep -q build-essential || missing_packages+=("build-essential")
    dpkg -l | grep -q ca-certificates || missing_packages+=("ca-certificates")
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        log_success "All system dependencies are installed"
        return 0
    fi
    
    log_info "Missing packages: ${missing_packages[*]}"
    echo ""
    
    if confirm "Install missing packages? (requires sudo)"; then
        log_info "Installing packages..."
        sudo apt-get update -qq
        sudo apt-get install -y "${missing_packages[@]}"
        log_success "System dependencies installed"
    else
        log_warning "Skipping automatic installation"
        log_info "You can install manually with:"
        log_info "  sudo apt-get update"
        log_info "  sudo apt-get install -y ${missing_packages[*]}"
        echo ""
        
        if ! confirm "Continue anyway?"; then
            log_info "Bootstrap cancelled by user"
            exit 0
        fi
    fi
    
    return 0
}

check_prerequisites() {
    log_step "Step 2/7: Checking Prerequisites"
    
    if bash "$CHECK_PREREQ"; then
        log_success "Prerequisites check passed"
        return 0
    else
        log_error "Prerequisites check failed"
        log_info "Please resolve the issues and run this script again"
        return 1
    fi
}

install_docker_if_needed() {
    log_step "Step 3/7: Installing Docker"
    
    # Check if Docker is already installed with correct version
    if check_docker_version 24.0 && check_docker_compose_v2; then
        log_info "Docker is already installed with correct version"
        log_success "Skipping Docker installation"
        return 0
    fi
    
    log_info "Installing Docker Engine and Docker Compose V2..."
    
    if bash "$INSTALL_DOCKER"; then
        log_success "Docker installed successfully"
        return 0
    else
        log_error "Docker installation failed"
        return 1
    fi
}

setup_docker_permissions() {
    log_step "Step 4/7: Setting Up Docker Permissions"
    
    if is_in_docker_group && docker ps >/dev/null 2>&1; then
        log_info "Docker permissions already configured"
        log_success "Skipping permissions setup"
        return 0
    fi
    
    log_info "Adding user to docker group..."
    
    if bash "$SETUP_PERMISSIONS"; then
        if ! is_in_docker_group; then
            # User was just added to group
            NEED_LOGOUT=true
        fi
        log_success "Permissions configured"
        return 0
    else
        log_error "Failed to setup permissions"
        return 1
    fi
}

configure_hosts() {
    log_step "Step 5/7: Configuring DNS (hosts file)"
    
    if grep -q "my.appserver.test" /etc/hosts 2>/dev/null; then
        log_info "/etc/hosts already configured"
        log_success "Skipping hosts configuration"
        return 0
    fi
    
    log_info "Adding local development DNS entries..."
    
    if bash "$SETUP_HOSTS"; then
        log_success "Hosts configured"
        return 0
    else
        log_error "Failed to configure hosts"
        return 1
    fi
}

setup_environment() {
    log_step "Step 6/7: Setting Up Environment Variables"
    
    if [ -f "${REPO_ROOT}/.env" ]; then
        log_info ".env file already exists"
        log_success "Skipping environment setup"
        return 0
    fi
    
    log_info "Creating .env configuration..."
    
    if bash "$SETUP_ENV"; then
        log_success "Environment configured"
        return 0
    else
        log_error "Failed to setup environment"
        return 1
    fi
}

increase_inotify_limits() {
    log_info "Increasing inotify limits for hot reload..."
    
    local current_limit
    current_limit=$(cat /proc/sys/fs/inotify/max_user_watches)
    local recommended_limit=524288
    
    if [ "$current_limit" -ge "$recommended_limit" ]; then
        log_success "inotify limit already sufficient"
        return 0
    fi
    
    # Set temporarily
    if sudo sysctl -w fs.inotify.max_user_watches=$recommended_limit >/dev/null 2>&1; then
        log_success "inotify limit increased temporarily"
    fi
    
    # Make permanent
    if ! grep -q "fs.inotify.max_user_watches" /etc/sysctl.conf 2>/dev/null; then
        if echo "fs.inotify.max_user_watches=$recommended_limit" | sudo tee -a /etc/sysctl.conf >/dev/null; then
            log_success "inotify limit will persist after reboot"
        fi
    fi
    
    return 0
}

validate_installation() {
    log_step "Step 7/7: Validating Installation"
    
    log_info "Running validation checks..."
    
    if bash "$VALIDATE"; then
        log_success "Validation passed"
        return 0
    else
        log_warning "Some validation checks failed"
        echo ""
        
        # Check if port conflicts were the issue
        if grep -q "Port conflicts detected" "${VALIDATE}" 2>/dev/null || \
           [ -f "${SCRIPT_DIR}/check-port-conflicts.sh" ] && \
           ! bash "${SCRIPT_DIR}/check-port-conflicts.sh" >/dev/null 2>&1; then
            
            log_info "Port conflict resolution:"
            log_info ""
            log_info "  Option 1 - Stop conflicting services:"
            log_info "    sudo systemctl stop apache2    # If Apache is running"
            log_info "    sudo systemctl stop nginx      # If Nginx is running"
            log_info "    sudo systemctl stop postgresql # If PostgreSQL is running"
            log_info ""
            log_info "  Option 2 - Configure MyAEGEE to use different ports:"
            log_info "    Edit .env and add port overrides (see troubleshooting docs)"
            log_info ""
            log_info "  Run port conflict check manually:"
            log_info "    ${SCRIPT_DIR}/check-port-conflicts.sh --interactive"
            echo ""
        fi
        
        log_info "You may still be able to proceed, but some issues were detected"
        log_info "For troubleshooting help, see: docs/troubleshooting-ubuntu.md"
        return 0  # Don't fail the bootstrap for non-critical validation issues
    fi
}

print_next_steps() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║              🎉 Bootstrap Complete! 🎉                   ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    if [ "$NEED_LOGOUT" = true ]; then
        log_warning "IMPORTANT: You must log out and log back in!"
        echo ""
        log_info "Group membership changes require a new login session."
        log_info ""
        log_info "After logging back in, run:"
        log_info "  cd ${REPO_ROOT}"
        log_info "  make start"
        echo ""
        log_info "Or, for testing only (temporary, current terminal only):"
        log_info "  newgrp docker"
        log_info "  make start"
    else
        log_success "You're ready to start MyAEGEE!"
        echo ""
        log_info "Next steps:"
        log_info "  1. Review .env configuration (optional):"
        log_info "     vim ${REPO_ROOT}/.env"
        echo ""
        log_info "  2. Start all services:"
        log_info "     make start"
        echo ""
        log_info "  3. Monitor logs:"
        log_info "     make monitor"
        echo ""
        log_info "  4. Access the application:"
        log_info "     Frontend:  http://my.appserver.test"
        log_info "     Traefik:   http://traefik.appserver.test"
    fi
    
    echo ""
    log_info "For help and troubleshooting:"
    log_info "  - See: specs/001-direct-docker-ubuntu/quickstart.md"
    log_info "  - Or: docs/troubleshooting-ubuntu.md"
    echo ""
}

main() {
    print_banner
    
    log_info "This script will set up MyAEGEE for direct Docker development on Ubuntu 24.04"
    log_info "Repository: ${REPO_ROOT}"
    echo ""
    
    # Check if running on Ubuntu 24.04
    if ! is_ubuntu_2404; then
        log_error "This script requires Ubuntu 24.04 LTS"
        if is_ubuntu; then
            log_info "You are running Ubuntu $(get_ubuntu_version)"
        else
            log_info "You are not running Ubuntu"
        fi
        log_info "Please use Ubuntu 24.04 or the Vagrant setup for other systems"
        exit 1
    fi
    
    echo ""
    log_info "This script will:"
    log_info "  • Install missing system packages (if needed)"
    log_info "  • Check system requirements"
    log_info "  • Install Docker Engine 24.0+ and Docker Compose V2"
    log_info "  • Add your user to the docker group"
    log_info "  • Configure /etc/hosts for local development"
    log_info "  • Set up environment configuration"
    log_info "  • Validate the installation"
    echo ""
    
    if ! confirm "Do you want to continue?"; then
        log_info "Bootstrap cancelled by user"
        exit 0
    fi
    
    echo ""
    
    # Run setup steps
    install_system_dependencies || exit 1
    echo ""
    
    check_prerequisites || exit 1
    echo ""
    
    install_docker_if_needed || exit 1
    echo ""
    
    setup_docker_permissions || exit 1
    echo ""
    
    configure_hosts || exit 1
    echo ""
    
    setup_environment || exit 1
    echo ""
    
    increase_inotify_limits
    echo ""
    
    validate_installation
    echo ""
    
    # Print next steps
    print_next_steps
    
    exit 0
}

# Run main function
main "$@"

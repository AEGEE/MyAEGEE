#!/bin/bash
# Install Docker Engine and Docker Compose V2 on Ubuntu 24.04
# Following official Docker documentation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

install_docker() {
    log_step "Installing Docker Engine"
    
    # Check if already installed
    if check_docker_version 24.0; then
        local docker_version
        docker_version=$(docker --version | extract_version)
        log_success "Docker ${docker_version} is already installed"
        return 0
    fi
    
    # Check if older version is installed
    if command_exists docker; then
        local old_version
        old_version=$(docker --version | extract_version)
        log_warning "Docker ${old_version} is installed but version 24.0+ is required"
        echo ""
        log_info "To upgrade Docker:"
        log_info "  1. Remove old version: sudo apt-get remove -y docker docker-engine docker.io containerd runc"
        log_info "  2. Re-run this script to install Docker 24.0+"
        echo ""
        log_info "Note: Removing Docker will not delete your images, containers, or volumes."
        log_info "      Data is stored in /var/lib/docker/ and will be preserved."
        echo ""
        
        if confirm "Remove old Docker version and install 24.0+ now?"; then
            log_info "Removing old Docker version..."
            sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
            log_success "Old version removed"
        else
            log_error "Docker 24.0+ is required. Please upgrade manually."
            return 1
        fi
    fi
    
    # Remove old versions (if not already done)
    log_info "Ensuring old Docker versions are removed..."
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Update package index
    log_info "Updating package index..."
    sudo apt-get update -qq
    
    # Install prerequisites
    log_info "Installing prerequisites..."
    sudo apt-get install -y -qq \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    log_info "Adding Docker GPG key..."
    sudo install -m 0755 -d /etc/apt/keyrings
    
    if [ -f /etc/apt/keyrings/docker.asc ]; then
        log_info "Docker GPG key already exists"
    else
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
            sudo tee /etc/apt/keyrings/docker.asc > /dev/null
        sudo chmod a+r /etc/apt/keyrings/docker.asc
        log_success "Docker GPG key added"
    fi
    
    # Add Docker repository
    log_info "Adding Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    log_success "Docker repository added"
    
    # Update package index again
    log_info "Updating package index with Docker repository..."
    sudo apt-get update -qq
    
    # Install Docker Engine, CLI, containerd, and plugins
    log_info "Installing Docker Engine, CLI, and plugins..."
    log_info "This may take a few minutes..."
    
    sudo apt-get install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin
    
    # Verify installation
    local installed_version
    installed_version=$(docker --version | extract_version)
    
    if check_docker_version 24.0; then
        log_success "Docker ${installed_version} installed successfully!"
    else
        log_warning "Docker ${installed_version} installed, but version < 24.0"
        log_info "Some features may not work correctly"
    fi
    
    # Verify Compose V2
    if check_docker_compose_v2; then
        local compose_version
        compose_version=$(docker compose version | grep -oP 'v\d+\.\d+\.\d+' | head -n1)
        log_success "Docker Compose ${compose_version} installed"
    else
        log_error "Docker Compose V2 not available"
        return 1
    fi
    
    # Start and enable Docker service
    log_info "Starting Docker service..."
    sudo systemctl start docker
    sudo systemctl enable docker
    
    log_success "Docker service started and enabled"
    
    return 0
}

main() {
    log_step "Docker Installation for MyAEGEE"
    
    # Check if running on Ubuntu 24.04
    if ! is_ubuntu_2404; then
        log_error "This script is for Ubuntu 24.04 only"
        log_info "Current system: $(get_ubuntu_version)"
        exit 1
    fi
    
    # Check for sudo access
    if ! has_sudo && ! is_root; then
        log_error "This script requires sudo access"
        log_info "Please run: sudo -v"
        exit 1
    fi
    
    # Check internet connectivity
    log_info "Checking internet connectivity..."
    if ! curl -s --connect-timeout 10 https://download.docker.com >/dev/null 2>&1; then
        log_error "Cannot reach Docker repository"
        log_info "Please check your internet connection"
        log_info "If behind a proxy, configure it first:"
        log_info "  export http_proxy=http://proxy:port"
        log_info "  export https_proxy=http://proxy:port"
        exit 1
    fi
    log_success "Internet connectivity OK"
    
    # Install Docker
    if install_docker; then
        echo ""
        log_success "Docker installation complete!"
        echo ""
        log_info "Next steps:"
        log_info "  1. Add your user to the docker group (next script will do this)"
        log_info "  2. Log out and log back in for group changes to take effect"
        log_info "  3. Verify installation: docker run hello-world"
        return 0
    else
        log_error "Docker installation failed"
        log_info "Please check the error messages above"
        log_info "You may need to:"
        log_info "  - Check your internet connection"
        log_info "  - Verify proxy settings"
        log_info "  - Check available disk space"
        return 1
    fi
}

# Run main function
main "$@"

#!/bin/bash
# Add user to docker group for running Docker without sudo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

main() {
    log_step "Setting up Docker permissions"
    
    # Check if user is already in docker group
    if is_in_docker_group; then
        log_success "User '$USER' is already in the docker group"
        
        # Check if can actually run docker
        if docker ps >/dev/null 2>&1; then
            log_success "Docker is accessible without sudo"
            return 0
        else
            log_warning "In docker group but cannot access Docker daemon"
            log_info "The daemon may not be running. Try: sudo systemctl start docker"
            log_info "Or you may need to log out and log back in for group changes to take effect"
        fi
        
        return 0
    fi
    
    # Add user to docker group
    log_info "Adding user '$USER' to docker group..."
    
    if sudo usermod -aG docker "$USER"; then
        log_success "User '$USER' added to docker group"
    else
        log_error "Failed to add user to docker group"
        return 1
    fi
    
    # Important notice
    echo ""
    log_warning "IMPORTANT: You must log out and log back in for group changes to take effect!"
    echo ""
    log_info "Group membership changes require a new login session to activate."
    log_info ""
    log_info "Two options:"
    log_info "  1. Log out and log back in (RECOMMENDED)"
    log_info "     - Applies changes system-wide"
    log_info "     - Permanent across all terminals"
    log_info ""
    log_info "  2. Run 'newgrp docker' in current terminal (TEMPORARY)"
    log_info "     - Only affects current terminal session"
    log_info "     - Good for testing, but won't persist after closing terminal"
    echo ""
    
    # Verification instructions
    log_info "After logging back in, verify with:"
    log_info "  groups | grep docker"
    log_info "  docker ps"
    echo ""
    
    return 0
}

# Run main function
main "$@"

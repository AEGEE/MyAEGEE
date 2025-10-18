#!/bin/bash
# Set up environment configuration for MyAEGEE

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

main() {
    log_step "Setting up environment configuration"
    
    local env_file="${REPO_ROOT}/.env"
    local env_example="${REPO_ROOT}/.env.example"
    
    # Check if .env already exists
    if [ -f "$env_file" ]; then
        log_success ".env file already exists"
        
        # Check if MYAEGEE_ENVIRONMENT is set
        if grep -q "^MYAEGEE_ENVIRONMENT=" "$env_file"; then
            local current_env
            current_env=$(grep "^MYAEGEE_ENVIRONMENT=" "$env_file" | cut -d= -f2)
            log_info "Current environment: ${current_env:-auto-detect}"
        else
            log_info "Adding MYAEGEE_ENVIRONMENT variable..."
            echo "MYAEGEE_ENVIRONMENT=direct" >> "$env_file"
            log_success "Added MYAEGEE_ENVIRONMENT=direct"
        fi
        
        return 0
    fi
    
    # Create .env from example
    if [ ! -f "$env_example" ]; then
        log_error ".env.example not found at: $env_example"
        return 1
    fi
    
    log_info "Creating .env from .env.example..."
    cp "$env_example" "$env_file"
    
    # Set MYAEGEE_ENVIRONMENT to direct
    if grep -q "^MYAEGEE_ENVIRONMENT=" "$env_file"; then
        sed -i 's/^MYAEGEE_ENVIRONMENT=.*/MYAEGEE_ENVIRONMENT=direct/' "$env_file"
    else
        echo "MYAEGEE_ENVIRONMENT=direct" >> "$env_file"
    fi
    
    log_success ".env file created"
    
    # Information about .env
    echo ""
    log_info "Environment configuration:"
    log_info "  File: $env_file"
    log_info "  Mode: direct (Docker on host, not Vagrant)"
    echo ""
    
    log_info "Important .env variables:"
    log_info "  BASE_URL=appserver.test (already configured)"
    log_info "  MYAEGEE_ENVIRONMENT=direct (auto-detect override)"
    log_info "  ENABLED_SERVICES=... (services to run)"
    echo ""
    
    log_warning "Review and customize .env for your needs:"
    log_info "  - Set CORE_LOGIN and CORE_PASSWORD for admin access"
    log_info "  - Configure SMTP settings for email functionality"
    log_info "  - Enable/disable services via ENABLED_SERVICES"
    echo ""
    
    return 0
}

# Run main function
main "$@"

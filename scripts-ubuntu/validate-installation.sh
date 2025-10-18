#!/bin/bash
# Validate MyAEGEE installation and environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

validate_docker() {
    log_info "Validating Docker installation..."
    
    if ! command_exists docker; then
        log_error "Docker is not installed"
        return 1
    fi
    
    local docker_version
    docker_version=$(docker --version | extract_version)
    log_success "Docker ${docker_version} is installed"
    
    if ! check_docker_version 24.0; then
        log_warning "Docker version < 24.0 (some features may not work)"
    fi
    
    # Check Docker daemon
    if docker ps >/dev/null 2>&1; then
        log_success "Docker daemon is running and accessible"
    else
        log_error "Cannot access Docker daemon"
        log_info "Try: sudo systemctl start docker"
        log_info "Or: log out and back in if recently added to docker group"
        return 1
    fi
    
    # Check Compose V2
    if check_docker_compose_v2; then
        log_success "Docker Compose V2 is available"
    else
        log_error "Docker Compose V2 is not available"
        return 1
    fi
    
    return 0
}

validate_ports() {
    log_info "Checking port availability..."
    
    # Use the comprehensive port conflict checker
    if [ -f "${SCRIPT_DIR}/check-port-conflicts.sh" ]; then
        # Source the script to use its functions
        # shellcheck disable=SC1091
        source "${SCRIPT_DIR}/check-port-conflicts.sh"
        
        if check_all_ports; then
            return 0
        else
            log_error "Port conflicts detected - see resolution options above"
            return 1
        fi
    else
        # Fallback to basic check if check-port-conflicts.sh doesn't exist
        log_warning "check-port-conflicts.sh not found, using basic port check"
        
        local critical_ports=(80 443)
        local optional_ports=(5432 6379)
        local has_conflicts=false
        
        for port in "${critical_ports[@]}"; do
            if is_port_in_use "$port"; then
                local process
                process=$(get_port_process "$port")
                log_error "Critical port $port is in use by: $process"
                has_conflicts=true
            else
                log_success "Port $port is available"
            fi
        done
        
        for port in "${optional_ports[@]}"; do
            if is_port_in_use "$port"; then
                local process
                process=$(get_port_process "$port")
                log_warning "Port $port is in use by: $process"
                log_info "This may cause conflicts with MyAEGEE services"
            else
                log_success "Port $port is available"
            fi
        done
        
        if [ "$has_conflicts" = true ]; then
            log_error "Port conflicts detected"
            log_info "You need to either:"
            log_info "  1. Stop the conflicting services, or"
            log_info "  2. Configure MyAEGEE to use different ports in .env"
            return 1
        fi
        
        return 0
    fi
}

validate_hosts() {
    log_info "Validating /etc/hosts configuration..."
    
    if grep -q "my.appserver.test" /etc/hosts 2>/dev/null; then
        log_success "/etc/hosts contains MyAEGEE entries"
        
        # Try to resolve
        if ping -c 1 -W 1 my.appserver.test >/dev/null 2>&1; then
            log_success "my.appserver.test resolves correctly"
        else
            log_warning "my.appserver.test is in /etc/hosts but ping failed"
            log_info "This is normal - the service needs to be running"
        fi
    else
        log_error "/etc/hosts does not contain MyAEGEE entries"
        log_info "Run: ${SCRIPT_DIR}/setup-hosts.sh"
        return 1
    fi
    
    return 0
}

validate_environment() {
    log_info "Validating environment configuration..."
    
    local repo_root
    repo_root="$(cd "${SCRIPT_DIR}/.." && pwd)"
    local env_file="${repo_root}/.env"
    
    if [ -f "$env_file" ]; then
        log_success ".env file exists"
        
        # Check key variables
        if grep -q "^BASE_URL=" "$env_file"; then
            local base_url
            base_url=$(grep "^BASE_URL=" "$env_file" | cut -d= -f2)
            log_success "BASE_URL is set to: $base_url"
        else
            log_warning "BASE_URL not set in .env"
        fi
        
        if grep -q "^ENABLED_SERVICES=" "$env_file"; then
            log_success "ENABLED_SERVICES is configured"
        else
            log_warning "ENABLED_SERVICES not set in .env"
        fi
    else
        log_error ".env file not found"
        log_info "Run: ${SCRIPT_DIR}/setup-environment.sh"
        return 1
    fi
    
    return 0
}

validate_inotify() {
    log_info "Checking inotify limits for hot reload..."
    
    local current_limit
    current_limit=$(cat /proc/sys/fs/inotify/max_user_watches)
    local recommended_limit=524288
    
    if [ "$current_limit" -ge "$recommended_limit" ]; then
        log_success "inotify limit is sufficient: $current_limit"
    else
        log_warning "inotify limit is low: $current_limit (recommended: $recommended_limit)"
        log_info "Hot reload may not work for all files"
        log_info "To increase: sudo sysctl -w fs.inotify.max_user_watches=$recommended_limit"
        log_info "To make permanent: echo 'fs.inotify.max_user_watches=$recommended_limit' | sudo tee -a /etc/sysctl.conf"
    fi
    
    return 0
}

main() {
    log_step "Validating MyAEGEE Installation"
    
    local validation_passed=true
    
    # Run validations
    validate_docker || validation_passed=false
    echo ""
    
    validate_ports || validation_passed=false
    echo ""
    
    validate_hosts || validation_passed=false
    echo ""
    
    validate_environment || validation_passed=false
    echo ""
    
    validate_inotify  # Non-critical, doesn't affect validation_passed
    echo ""
    
    # Summary
    log_step "Validation Summary"
    
    if [ "$validation_passed" = true ]; then
        log_success "All critical validations passed!"
        log_info "System is ready to run MyAEGEE"
        echo ""
        log_info "Next steps:"
        log_info "  1. Review .env configuration if needed"
        log_info "  2. Start services: make start"
        log_info "  3. Access frontend: http://my.appserver.test"
        return 0
    else
        log_error "Some validations failed"
        log_info "Please resolve the issues above before starting services"
        return 1
    fi
}

# Run main function
main "$@"

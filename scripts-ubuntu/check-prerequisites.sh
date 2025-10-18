#!/bin/bash
# Check prerequisites for MyAEGEE direct Docker setup on Ubuntu
# This script validates the system meets requirements

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

main() {
    log_step "Checking prerequisites for MyAEGEE setup"
    
    local all_checks_passed=true
    
    # Check 1: OS Detection
    log_info "Checking operating system..."
    if is_ubuntu_2404; then
        log_success "Running on Ubuntu 24.04 LTS"
    else
        log_error "This script requires Ubuntu 24.04 LTS"
        if is_ubuntu; then
            log_info "Detected Ubuntu $(get_ubuntu_version)"
            log_info "Please upgrade to Ubuntu 24.04 or use the Vagrant setup"
        else
            log_info "Non-Ubuntu system detected"
            log_info "Please use Ubuntu 24.04 or the Vagrant setup for other systems"
        fi
        all_checks_passed=false
    fi
    
    # Check 2: Sudo access
    log_info "Checking sudo access..."
    if has_sudo || is_root; then
        log_success "Sudo access available"
    else
        log_warning "Sudo access required for Docker installation"
        log_info "You will be prompted for your password during installation"
        # Try sudo with prompt
        if sudo -v; then
            log_success "Sudo access granted"
        else
            log_error "Cannot obtain sudo access. Please run: sudo -v"
            all_checks_passed=false
        fi
    fi
    
    # Check 3: Disk space
    log_info "Checking available disk space..."
    local disk_space
    disk_space=$(get_disk_space_gb .)
    
    if [ "$disk_space" -ge 20 ]; then
        log_success "Sufficient disk space: ${disk_space}GB available"
    elif [ "$disk_space" -ge 10 ]; then
        log_warning "Limited disk space: ${disk_space}GB available (20GB recommended)"
        log_info "Setup may fail if Docker images consume all available space"
    else
        log_error "Insufficient disk space: ${disk_space}GB available (20GB required)"
        log_info "Please free up disk space before continuing"
        all_checks_passed=false
    fi
    
    # Check 4: Docker installation (if exists)
    log_info "Checking for existing Docker installation..."
    if command_exists docker; then
        local docker_version
        docker_version=$(docker --version | extract_version)
        
        if [ -n "$docker_version" ]; then
            if check_docker_version 24.0; then
                log_success "Docker ${docker_version} installed (meets requirements)"
            else
                log_warning "Docker ${docker_version} installed (24.0+ recommended)"
                log_info "Some features may not work correctly"
                log_info "Consider upgrading: sudo apt-get install --only-upgrade docker-ce"
            fi
        else
            log_warning "Docker installed but version could not be determined"
        fi
        
        # Check Compose V2
        if check_docker_compose_v2; then
            log_success "Docker Compose V2 is available"
        else
            log_warning "Docker Compose V2 not found"
            log_info "Will be installed with Docker Engine"
        fi
        
        # Check docker group membership
        if is_in_docker_group; then
            log_success "User is in docker group"
            
            # Check if can actually run docker
            if docker ps >/dev/null 2>&1; then
                log_success "Docker daemon is accessible"
            else
                log_warning "Docker daemon not accessible"
                log_info "Try: sudo systemctl start docker"
            fi
        else
            log_warning "User not in docker group"
            log_info "Will be added during setup (requires logout/login)"
        fi
    else
        log_info "Docker not installed (will be installed during setup)"
    fi
    
    # Check 5: Required commands
    log_info "Checking for required system tools..."
    local missing_tools=()
    local missing_packages=()
    
    # Check git
    if command_exists git; then
        log_success "git is installed"
    else
        log_warning "git is not installed (required)"
        missing_tools+=("git")
        missing_packages+=("git")
    fi
    
    # Check make
    if command_exists make; then
        log_success "make is installed"
    else
        log_warning "make is not installed (required)"
        missing_tools+=("make")
        missing_packages+=("make")
    fi
    
    # Check curl
    if command_exists curl; then
        log_success "curl is installed"
    else
        log_warning "curl is not installed (required)"
        missing_tools+=("curl")
        missing_packages+=("curl")
    fi
    
    # Check build-essential (compile native modules)
    if dpkg -l | grep -q build-essential; then
        log_success "build-essential is installed"
    else
        log_warning "build-essential is not installed (recommended for native modules)"
        missing_tools+=("build tools")
        missing_packages+=("build-essential")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_info "Missing tools will be installed: ${missing_tools[*]}"
        log_info "Installation command: sudo apt-get install -y ${missing_packages[*]}"
    fi
    
    # Check 6: Port availability (common conflicts)
    log_info "Checking for port conflicts..."
    local ports_to_check=(80 443 5432)
    local conflicting_ports=()
    
    for port in "${ports_to_check[@]}"; do
        if is_port_in_use "$port"; then
            local process
            process=$(get_port_process "$port")
            log_warning "Port $port is in use by: $process"
            conflicting_ports+=("$port")
        else
            log_success "Port $port is available"
        fi
    done
    
    if [ ${#conflicting_ports[@]} -gt 0 ]; then
        log_warning "Some ports are in use. You may need to:"
        log_info "  - Stop conflicting services, or"
        log_info "  - Configure MyAEGEE to use different ports in .env file"
    fi
    
    # Check 7: Internet connectivity
    log_info "Checking internet connectivity..."
    if curl -s --connect-timeout 5 https://download.docker.com >/dev/null 2>&1; then
        log_success "Can reach Docker repository"
    else
        log_warning "Cannot reach Docker repository"
        log_info "Check your internet connection or proxy settings"
        log_info "If behind a corporate firewall, you may need to configure proxy"
    fi
    
    # Summary
    echo ""
    log_step "Prerequisites Check Summary"
    
    if [ "$all_checks_passed" = true ]; then
        log_success "All critical checks passed!"
        log_info "System is ready for MyAEGEE setup"
        return 0
    else
        log_error "Some critical checks failed"
        log_info "Please resolve the issues above before proceeding"
        return 1
    fi
}

# Run main function
main "$@"

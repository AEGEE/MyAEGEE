#!/bin/bash
# Check for port conflicts on required ports for MyAEGEE
# Detects processes listening on ports that MyAEGEE services need

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

# Required ports for MyAEGEE services
# Format: PORT:SERVICE:DESCRIPTION
declare -a REQUIRED_PORTS=(
    "80:traefik:Traefik HTTP proxy"
    "443:traefik:Traefik HTTPS proxy"
    "5432:postgres:PostgreSQL databases"
    "6379:redis:Redis cache"
    "9090:portainer:Portainer management UI"
)

# Check if a port is in use and get process information
check_port() {
    local port=$1
    local service=$2
    local description=$3
    
    # Use ss to check for listening processes on the port
    # -tuln: TCP and UDP, listening, numeric ports and addresses, no hostname resolution
    if sudo ss -tuln | grep -q ":${port} "; then
        log_warning "Port ${port} is already in use (needed by ${service})"
        
        # Get process information
        local pid
        local process_name
        local process_cmd
        
        # Try to get PID using lsof (if available)
        if command_exists lsof; then
            pid=$(sudo lsof -ti ":${port}" 2>/dev/null | head -n1 || echo "")
            if [ -n "$pid" ]; then
                process_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
                process_cmd=$(ps -p "$pid" -o args= 2>/dev/null || echo "unknown")
                log_info "  Process: ${process_name} (PID: ${pid})"
                log_info "  Command: ${process_cmd}"
            fi
        else
            # Fallback: use ss with process info (requires root)
            local ss_info
            ss_info=$(sudo ss -tulnp | grep ":${port} " | head -n1)
            if [ -n "$ss_info" ]; then
                log_info "  Details: ${ss_info}"
            fi
        fi
        
        return 1  # Port is in use
    else
        log_success "Port ${port} is available (${service})"
        return 0  # Port is available
    fi
}

# Main function to check all required ports
check_all_ports() {
    log_step "Checking Port Conflicts"
    
    local conflicts=0
    local total=${#REQUIRED_PORTS[@]}
    
    log_info "Checking ${total} required ports for MyAEGEE services..."
    echo ""
    
    for port_spec in "${REQUIRED_PORTS[@]}"; do
        IFS=':' read -r port service description <<< "$port_spec"
        
        if ! check_port "$port" "$service" "$description"; then
            conflicts=$((conflicts + 1))
        fi
    done
    
    echo ""
    
    if [ $conflicts -gt 0 ]; then
        log_error "Found ${conflicts} port conflict(s)"
        echo ""
        log_info "Resolution options:"
        log_info "  1. Stop the conflicting services:"
        log_info "     sudo systemctl stop <service-name>"
        log_info "     # or for Docker containers:"
        log_info "     docker stop <container-name>"
        echo ""
        log_info "  2. Change MyAEGEE port configuration:"
        log_info "     Edit .env file and modify port mappings"
        log_info "     See docs/troubleshooting-ubuntu.md for details"
        echo ""
        log_info "  3. Disable services from starting automatically:"
        log_info "     sudo systemctl disable <service-name>"
        echo ""
        return 1
    else
        log_success "All ${total} required ports are available"
        return 0
    fi
}

# Function to get detailed information about a specific port conflict
get_port_resolution_help() {
    local port=$1
    
    case $port in
        80|443)
            echo "Ports 80/443 are used by Traefik as the main HTTP/HTTPS proxy."
            echo "Common conflicts: Apache (httpd), Nginx, other web servers"
            echo ""
            echo "To stop Apache: sudo systemctl stop apache2"
            echo "To stop Nginx: sudo systemctl stop nginx"
            echo ""
            echo "To change Traefik ports, edit .env and add:"
            echo "  TRAEFIK_HTTP_PORT=8080"
            echo "  TRAEFIK_HTTPS_PORT=8443"
            ;;
        5432)
            echo "Port 5432 is used by PostgreSQL services."
            echo "Common conflict: System-installed PostgreSQL"
            echo ""
            echo "To stop PostgreSQL: sudo systemctl stop postgresql"
            echo ""
            echo "Note: MyAEGEE uses containerized PostgreSQL instances."
            echo "Your system PostgreSQL is separate and won't be affected."
            ;;
        6379)
            echo "Port 6379 is used by Redis cache."
            echo "Common conflict: System-installed Redis"
            echo ""
            echo "To stop Redis: sudo systemctl stop redis-server"
            ;;
        9090)
            echo "Port 9090 is used by Portainer management UI."
            echo "Common conflicts: Prometheus, other monitoring tools"
            echo ""
            echo "To change Portainer port, edit .env and add:"
            echo "  PORTAINER_PORT=9091"
            ;;
        *)
            echo "No specific guidance available for port ${port}"
            ;;
    esac
}

# Interactive mode - check and offer to resolve conflicts
interactive_port_check() {
    if ! check_all_ports; then
        echo ""
        
        if confirm "Would you like detailed resolution help for specific ports?"; then
            echo ""
            log_info "Available ports: 80, 443, 5432, 6379, 9090"
            read -rp "Enter port number (or 'skip' to continue): " port_choice
            
            if [[ "$port_choice" =~ ^[0-9]+$ ]]; then
                echo ""
                get_port_resolution_help "$port_choice"
                echo ""
            fi
        fi
        
        return 1
    fi
    
    return 0
}

# If script is run directly (not sourced), run the check
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Check if running with --interactive flag
    if [ "${1:-}" = "--interactive" ]; then
        interactive_port_check
    else
        check_all_ports
    fi
fi

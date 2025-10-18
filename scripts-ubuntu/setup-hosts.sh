#!/bin/bash
# Configure /etc/hosts for MyAEGEE local development

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

readonly MARKER_START="# MyAEGEE local development - START"
readonly MARKER_END="# MyAEGEE local development - END"
readonly HOSTS_FILE="/etc/hosts"

main() {
    log_step "Configuring /etc/hosts for local development"
    
    # Check if entries already exist
    if grep -q "$MARKER_START" "$HOSTS_FILE" 2>/dev/null; then
        log_success "/etc/hosts entries already configured"
        log_info "Existing entries:"
        sudo grep -A 2 "$MARKER_START" "$HOSTS_FILE"
        return 0
    fi
    
    log_info "Adding local development DNS entries..."
    log_warning "This requires sudo access to modify /etc/hosts"
    
    # Backup hosts file
    backup_file "$HOSTS_FILE"
    
    # Append entries
    log_info "Adding entries for appserver.test and subdomains..."
    
    if sudo tee -a "$HOSTS_FILE" > /dev/null <<EOF

$MARKER_START
127.0.0.1 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test pgadmin.appserver.test
$MARKER_END
EOF
    then
        log_success "/etc/hosts configured successfully"
    else
        log_error "Failed to update /etc/hosts"
        return 1
    fi
    
    # Verify entries
    log_info "Verifying entries..."
    if grep -q "my.appserver.test" "$HOSTS_FILE"; then
        log_success "Entries verified"
        
        # Show what was added
        echo ""
        log_info "Added entries:"
        sudo grep -A 2 "$MARKER_START" "$HOSTS_FILE"
        echo ""
    else
        log_error "Verification failed"
        return 1
    fi
    
    # Usage information
    log_info "You can now access:"
    log_info "  Frontend:  http://my.appserver.test"
    log_info "  Traefik:   http://traefik.appserver.test"
    log_info "  Portainer: http://portainer.appserver.test"
    log_info "  pgAdmin:   http://pgadmin.appserver.test"
    echo ""
    
    # Cleanup information
    log_info "To remove these entries later, run:"
    log_info "  sudo sed -i '/$MARKER_START/,/$MARKER_END/d' /etc/hosts"
    echo ""
    
    return 0
}

# Run main function
main "$@"

#!/bin/bash
# Migrate data from Vagrant setup to direct Docker setup
# This script helps existing Vagrant users transition to native Docker on Ubuntu 24.04
# SAFETY: This script never deletes Vagrant data - migration is non-destructive

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

# Migration configuration
BACKUP_DIR="${REPO_ROOT}/migration-backup-$(date +%Y%m%d-%H%M%S)"
VAGRANT_VM_NAME="default"

# Services with PostgreSQL databases to migrate
declare -a DB_SERVICES=(
    "core"
    "events"
    "statutory"
    "discounts"
    "summeruniversity"
    "knowledge"
)

# Services with volumes to migrate (non-database)
declare -a VOLUME_SERVICES=(
    "portainer"
)

print_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║        MyAEGEE Migration: Vagrant → Direct Docker        ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
}

check_prerequisites() {
    log_step "Step 1/7: Checking Prerequisites"
    
    # Check if Vagrant is installed
    if ! command_exists vagrant; then
        log_error "Vagrant is not installed"
        log_info "This script migrates data FROM Vagrant TO direct Docker"
        log_info "If you don't have Vagrant data, you don't need this migration"
        return 1
    fi
    
    log_success "Vagrant is installed"
    
    # Check if Vagrant VM exists
    cd "$REPO_ROOT"
    if ! vagrant status 2>/dev/null | grep -q "running"; then
        log_warning "Vagrant VM is not running"
        log_info ""
        
        if confirm "Start Vagrant VM now? (required for migration)"; then
            log_info "Starting Vagrant VM..."
            vagrant up
            log_success "Vagrant VM started"
        else
            log_error "Migration requires Vagrant VM to be running"
            return 1
        fi
    else
        log_success "Vagrant VM is running"
    fi
    
    # Check if direct Docker setup is ready
    if ! check_docker_version 24.0; then
        log_error "Docker 24.0+ is required for direct Docker setup"
        log_info "Please run: ./scripts-ubuntu/bootstrap.sh"
        return 1
    fi
    
    log_success "Direct Docker environment is ready"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    log_success "Created backup directory: ${BACKUP_DIR}"
    
    return 0
}

backup_vagrant_env() {
    log_step "Step 2/7: Backing Up Configuration"
    
    # Backup current .env from Vagrant
    if [ -f "${REPO_ROOT}/.env" ]; then
        log_info "Backing up current .env file..."
        cp "${REPO_ROOT}/.env" "${BACKUP_DIR}/.env.vagrant"
        log_success "Backed up .env to ${BACKUP_DIR}/.env.vagrant"
    else
        log_warning "No .env file found (this is unusual)"
    fi
    
    # Backup Vagrantfile for reference
    if [ -f "${REPO_ROOT}/Vagrantfile" ]; then
        cp "${REPO_ROOT}/Vagrantfile" "${BACKUP_DIR}/Vagrantfile"
        log_success "Backed up Vagrantfile"
    fi
    
    return 0
}

export_database_volumes() {
    log_step "Step 3/7: Exporting Database Volumes"
    
    log_info "Exporting PostgreSQL databases from Vagrant..."
    echo ""
    
    local success_count=0
    local total_count=${#DB_SERVICES[@]}
    
    for service in "${DB_SERVICES[@]}"; do
        local volume_name="myaegee_postgres-${service}"
        local export_file="${BACKUP_DIR}/${service}-postgres.tar"
        
        log_info "Exporting ${service} database..."
        
        # Check if volume exists in Vagrant
        if vagrant ssh -c "docker volume ls -q" 2>/dev/null | grep -q "${volume_name}"; then
            # Export volume using a temporary container
            vagrant ssh -c "
                docker run --rm \
                    -v ${volume_name}:/source:ro \
                    -v /vagrant:/backup \
                    busybox tar czf /backup/$(basename ${export_file}) -C /source .
            " 2>/dev/null
            
            # Move from /vagrant (shared folder) to backup directory
            if [ -f "${REPO_ROOT}/$(basename ${export_file})" ]; then
                mv "${REPO_ROOT}/$(basename ${export_file})" "${export_file}"
                log_success "✓ ${service} database exported ($(du -h ${export_file} | cut -f1))"
                success_count=$((success_count + 1))
            else
                log_warning "✗ ${service} database export failed"
            fi
        else
            log_warning "✗ ${service} database volume not found (may not have data)"
        fi
    done
    
    echo ""
    log_info "Exported ${success_count}/${total_count} databases"
    
    if [ $success_count -eq 0 ]; then
        log_warning "No databases were exported"
        log_info "This could mean:"
        log_info "  • Vagrant environment was never set up with data"
        log_info "  • Services haven't been started yet"
        log_info "  • Volume names have changed"
        echo ""
        
        if ! confirm "Continue anyway? (you'll have a fresh installation)"; then
            log_info "Migration cancelled by user"
            exit 0
        fi
    fi
    
    return 0
}

export_other_volumes() {
    log_step "Step 4/7: Exporting Other Data Volumes"
    
    log_info "Exporting non-database volumes from Vagrant..."
    echo ""
    
    for service in "${VOLUME_SERVICES[@]}"; do
        local volume_name="myaegee_${service}"
        local export_file="${BACKUP_DIR}/${service}-data.tar"
        
        log_info "Exporting ${service} data..."
        
        if vagrant ssh -c "docker volume ls -q" 2>/dev/null | grep -q "${volume_name}"; then
            vagrant ssh -c "
                docker run --rm \
                    -v ${volume_name}:/source:ro \
                    -v /vagrant:/backup \
                    busybox tar czf /backup/$(basename ${export_file}) -C /source .
            " 2>/dev/null
            
            if [ -f "${REPO_ROOT}/$(basename ${export_file})" ]; then
                mv "${REPO_ROOT}/$(basename ${export_file})" "${export_file}"
                log_success "✓ ${service} data exported"
            else
                log_warning "✗ ${service} data export failed"
            fi
        else
            log_info "✗ ${service} volume not found (skipping)"
        fi
    done
    
    return 0
}

import_database_volumes() {
    log_step "Step 5/7: Importing Database Volumes to Direct Docker"
    
    log_info "Creating and importing PostgreSQL databases..."
    echo ""
    
    local success_count=0
    
    for service in "${DB_SERVICES[@]}"; do
        local volume_name="myaegee_postgres-${service}"
        local import_file="${BACKUP_DIR}/${service}-postgres.tar"
        
        if [ ! -f "$import_file" ]; then
            log_info "✗ ${service} database: no export file (skipping)"
            continue
        fi
        
        log_info "Importing ${service} database..."
        
        # Create volume if it doesn't exist
        if ! docker volume ls -q | grep -q "^${volume_name}$"; then
            docker volume create "${volume_name}" >/dev/null
            log_info "  Created volume: ${volume_name}"
        fi
        
        # Import data using a temporary container
        docker run --rm \
            -v "${volume_name}:/target" \
            -v "${import_file}:/backup.tar:ro" \
            busybox tar xzf /backup.tar -C /target 2>/dev/null
        
        if [ $? -eq 0 ]; then
            log_success "✓ ${service} database imported"
            success_count=$((success_count + 1))
        else
            log_error "✗ ${service} database import failed"
        fi
    done
    
    echo ""
    log_info "Imported ${success_count} database(s)"
    
    return 0
}

import_other_volumes() {
    log_step "Step 6/7: Importing Other Data Volumes"
    
    log_info "Importing non-database volumes..."
    echo ""
    
    for service in "${VOLUME_SERVICES[@]}"; do
        local volume_name="myaegee_${service}"
        local import_file="${BACKUP_DIR}/${service}-data.tar"
        
        if [ ! -f "$import_file" ]; then
            log_info "✗ ${service} data: no export file (skipping)"
            continue
        fi
        
        log_info "Importing ${service} data..."
        
        if ! docker volume ls -q | grep -q "^${volume_name}$"; then
            docker volume create "${volume_name}" >/dev/null
        fi
        
        docker run --rm \
            -v "${volume_name}:/target" \
            -v "${import_file}:/backup.tar:ro" \
            busybox tar xzf /backup.tar -C /target 2>/dev/null
        
        if [ $? -eq 0 ]; then
            log_success "✓ ${service} data imported"
        else
            log_warning "✗ ${service} data import failed"
        fi
    done
    
    return 0
}

migrate_env_configuration() {
    log_step "Step 7/7: Migrating Environment Configuration"
    
    if [ ! -f "${BACKUP_DIR}/.env.vagrant" ]; then
        log_warning "No Vagrant .env backup found"
        log_info "Will use default configuration"
        return 0
    fi
    
    log_info "Comparing Vagrant .env with direct Docker template..."
    
    # Check if current .env exists
    if [ -f "${REPO_ROOT}/.env" ]; then
        log_info "Current .env already exists"
        log_info ""
        
        if confirm "Overwrite with migrated configuration from Vagrant?"; then
            cp "${REPO_ROOT}/.env" "${BACKUP_DIR}/.env.before-migration"
            log_info "Backed up current .env"
        else
            log_info "Keeping current .env configuration"
            return 0
        fi
    fi
    
    # Copy Vagrant .env as base
    cp "${BACKUP_DIR}/.env.vagrant" "${REPO_ROOT}/.env"
    
    # Ensure MYAEGEE_ENVIRONMENT is set correctly for direct Docker
    if grep -q "^MYAEGEE_ENVIRONMENT=" "${REPO_ROOT}/.env"; then
        sed -i 's/^MYAEGEE_ENVIRONMENT=.*/MYAEGEE_ENVIRONMENT=direct/' "${REPO_ROOT}/.env"
    else
        echo "" >> "${REPO_ROOT}/.env"
        echo "# Environment type: 'vagrant' or 'direct'" >> "${REPO_ROOT}/.env"
        echo "MYAEGEE_ENVIRONMENT=direct" >> "${REPO_ROOT}/.env"
    fi
    
    log_success "Environment configuration migrated"
    log_info "Review and adjust .env if needed"
    
    return 0
}

validate_migration() {
    log_info "Validating migration..."
    echo ""
    
    # Check volumes were created
    local volume_count=0
    for service in "${DB_SERVICES[@]}"; do
        local volume_name="myaegee_postgres-${service}"
        if docker volume ls -q | grep -q "^${volume_name}$"; then
            volume_count=$((volume_count + 1))
        fi
    done
    
    log_info "Database volumes created: ${volume_count}/${#DB_SERVICES[@]}"
    
    # Check .env exists
    if [ -f "${REPO_ROOT}/.env" ]; then
        log_success "Configuration file exists"
    else
        log_warning "No .env file (you may need to copy .env.example)"
    fi
    
    return 0
}

print_next_steps() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║              🎉 Migration Complete! 🎉                   ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    log_success "Your data has been migrated from Vagrant to direct Docker"
    echo ""
    
    log_info "Backup location: ${BACKUP_DIR}"
    log_info "  • All exported data is preserved here"
    log_info "  • Your Vagrant setup remains intact"
    log_info "  • You can safely revert if needed"
    echo ""
    
    log_info "Next steps:"
    echo ""
    log_info "  1. Start services with direct Docker:"
    log_info "     make start"
    echo ""
    log_info "  2. Verify services are running:"
    log_info "     docker ps"
    echo ""
    log_info "  3. Check logs for any errors:"
    log_info "     make logs"
    echo ""
    log_info "  4. Access the application:"
    log_info "     http://my.appserver.test"
    echo ""
    log_info "  5. Verify your data:"
    log_info "     • Log in with your existing credentials"
    log_info "     • Check that events/users/etc. are present"
    echo ""
    
    log_warning "Important: Test thoroughly before removing Vagrant!"
    echo ""
    log_info "To revert to Vagrant:"
    log_info "  1. Stop direct Docker: make stop"
    log_info "  2. Start Vagrant: vagrant up"
    log_info "  3. Use Vagrant setup: make start"
    echo ""
    
    log_info "To remove Vagrant after successful migration:"
    log_info "  1. Stop Vagrant VM: vagrant halt"
    log_info "  2. Remove VM: vagrant destroy"
    log_info "  3. (Optional) Uninstall VirtualBox and Vagrant"
    echo ""
    
    log_success "Happy developing with direct Docker! 🚀"
    echo ""
}

# Main migration workflow
main() {
    print_banner
    
    log_warning "IMPORTANT: This migration is NON-DESTRUCTIVE"
    log_info "• Your Vagrant setup will remain intact"
    log_info "• All data will be backed up to: migration-backup-*/"
    log_info "• You can safely test and revert if needed"
    echo ""
    
    log_info "This migration will:"
    log_info "  1. Export PostgreSQL databases from Vagrant"
    log_info "  2. Export configuration and data volumes"
    log_info "  3. Import everything into direct Docker volumes"
    log_info "  4. Migrate your .env configuration"
    echo ""
    
    if ! confirm "Do you want to continue with the migration?"; then
        log_info "Migration cancelled by user"
        exit 0
    fi
    
    echo ""
    
    # Run migration steps
    check_prerequisites || exit 1
    echo ""
    
    backup_vagrant_env || exit 1
    echo ""
    
    export_database_volumes || exit 1
    echo ""
    
    export_other_volumes || exit 1
    echo ""
    
    import_database_volumes || exit 1
    echo ""
    
    import_other_volumes || exit 1
    echo ""
    
    migrate_env_configuration || exit 1
    echo ""
    
    validate_migration
    echo ""
    
    print_next_steps
    
    exit 0
}

# Run main function
main "$@"

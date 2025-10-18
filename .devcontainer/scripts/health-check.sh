#!/bin/bash
# Health check functions for MyAEGEE services

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Check if PostgreSQL database is healthy
check_postgres_health() {
    local db_name=$1
    local container_name=$2
    local max_attempts=${3:-30}
    
    log_info "Checking PostgreSQL health for $db_name..."
    
    for i in $(seq 1 $max_attempts); do
        if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then
            log_success "$db_name is healthy"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "$db_name health check failed after $max_attempts attempts"
    return 1
}

# Check if HTTP service is healthy
check_http_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=${3:-30}
    
    log_info "Checking HTTP health for $service_name at $health_url..."
    
    for i in $(seq 1 $max_attempts); do
        if curl -sf "$health_url" >/dev/null 2>&1; then
            log_success "$service_name is healthy"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "$service_name health check failed after $max_attempts attempts"
    return 1
}

# Check if a container is running
check_container_running() {
    local container_name=$1
    
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        return 0
    else
        return 1
    fi
}

# Get container health status
get_container_health() {
    local container_name=$1
    
    if ! check_container_running "$container_name"; then
        echo "NOT_RUNNING"
        return 1
    fi
    
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null)
    
    if [ -z "$health_status" ]; then
        # No healthcheck defined, check if running
        local state=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null)
        if [ "$state" = "running" ]; then
            echo "RUNNING"
            return 0
        else
            echo "STOPPED"
            return 1
        fi
    fi
    
    echo "$health_status"
    
    if [ "$health_status" = "healthy" ]; then
        return 0
    else
        return 1
    fi
}

# Wait for all database containers to be healthy
wait_for_databases() {
    print_section "Waiting for databases to be ready"
    
    local databases=(
        "postgres-core:myaegee-postgres-core"
        "postgres-events:myaegee-postgres-events"
        "postgres-statutory:myaegee-postgres-statutory"
        "postgres-discounts:myaegee-postgres-discounts"
        "postgres-knowledge:myaegee-postgres-knowledge"
        "postgres-summeruniversity:myaegee-postgres-summeruniversity"
        "postgres-network:myaegee-postgres-network"
    )
    
    local failed=0
    
    for db_entry in "${databases[@]}"; do
        IFS=':' read -r db_name container_name <<< "$db_entry"
        
        if check_container_running "$container_name"; then
            check_postgres_health "$db_name" "$container_name" || ((failed++))
        else
            log_warning "$container_name is not running (may be disabled)"
        fi
    done
    
    if [ $failed -gt 0 ]; then
        log_error "$failed database(s) failed health checks"
        return 1
    fi
    
    log_success "All running databases are healthy"
    return 0
}

# Wait for all backend services to be healthy
wait_for_backend_services() {
    print_section "Waiting for backend services to be ready"
    
    local services=(
        "Core API:http://localhost:8084/healthcheck"
        "Events API:http://localhost:8085/healthcheck"
        "Statutory API:http://localhost:8086/healthcheck"
        "Discounts API:http://localhost:8087/healthcheck"
        "Knowledge API:http://localhost:8088/healthcheck"
        "Summer University API:http://localhost:8089/healthcheck"
        "Network API:http://localhost:8090/healthcheck"
    )
    
    local failed=0
    
    for service_entry in "${services[@]}"; do
        IFS=':' read -r service_name health_url <<< "$service_entry"
        health_url="${health_url}:${service_entry##*:}"
        
        # Try to check if service is accessible
        if curl -sf --max-time 2 "$health_url" >/dev/null 2>&1; then
            log_success "$service_name is ready"
        else
            log_warning "$service_name is not accessible (may be disabled or still starting)"
        fi
    done
    
    return 0
}

# Display comprehensive service status
display_service_status() {
    print_header "MyAEGEE Service Status"
    
    echo ""
    echo "DATABASE SERVICES:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    local db_containers=$(docker ps --format '{{.Names}}' | grep 'postgres-' | sort)
    
    if [ -z "$db_containers" ]; then
        echo "  No database containers running"
    else
        while IFS= read -r container; do
            local status=$(get_container_health "$container")
            local color=$RED
            [ "$status" = "healthy" ] || [ "$status" = "RUNNING" ] && color=$GREEN
            echo -e "  ${color}●${NC} $container: $status"
        done <<< "$db_containers"
    fi
    
    echo ""
    echo "BACKEND SERVICES:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    local api_ports=("8084:Core" "8085:Events" "8086:Statutory" "8087:Discounts" "8088:Knowledge" "8089:SummerUni" "8090:Network" "8091:Mailer" "8092:GSuite")
    
    for port_entry in "${api_ports[@]}"; do
        IFS=':' read -r port name <<< "$port_entry"
        if curl -sf --max-time 1 "http://localhost:${port}/healthcheck" >/dev/null 2>&1; then
            echo -e "  ${GREEN}●${NC} $name (localhost:$port): HEALTHY"
        else
            echo -e "  ${RED}●${NC} $name (localhost:$port): NOT ACCESSIBLE"
        fi
    done
    
    echo ""
}

# Verify database state (check if databases exist and have tables)
verify_database_state() {
    local db_container=$1
    local db_name=$2
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
        return 2  # Container not running
    fi
    
    # Check if database exists
    if ! docker exec "$db_container" psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$db_name"; then
        return 3  # Database doesn't exist
    fi
    
    # Check if database has tables
    local table_count=$(docker exec "$db_container" psql -U postgres -d "$db_name" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ')
    
    if [ -z "$table_count" ] || [ "$table_count" -eq 0 ]; then
        return 4  # Database exists but no tables
    fi
    
    return 0  # Database exists with tables
}

# Display database state information
display_database_state() {
    print_section "Database State"
    
    local databases=(
        "myaegee_postgres-core_1:oms-core-db"
        "myaegee_postgres-events_1:oms-events-db"
        "myaegee_postgres-statutory_1:oms-statutory-db"
        "myaegee_postgres-discounts_1:oms-discounts-db"
        "myaegee_postgres-knowledge_1:oms-knowledge-db"
        "myaegee_postgres-summeruniversity_1:oms-summeruniversity-db"
        "myaegee_postgres-network_1:oms-network-db"
    )
    
    for db_entry in "${databases[@]}"; do
        IFS=':' read -r container db_name <<< "$db_entry"
        
        verify_database_state "$container" "$db_name"
        local status=$?
        
        case $status in
            0)
                log_success "$db_name: Ready (has tables)"
                ;;
            2)
                log_warning "$db_name: Container not running"
                ;;
            3)
                log_error "$db_name: Database doesn't exist"
                ;;
            4)
                log_warning "$db_name: Database exists but no tables (migrations needed)"
                ;;
            *)
                log_error "$db_name: Unknown state"
                ;;
        esac
    done
}

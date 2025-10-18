#!/bin/bash
# Utility functions for dev container scripts

# Color output functions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# RAM detection function
# Returns available RAM in GB
get_available_ram_gb() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        free -g | awk '/^Mem:/{print $7}'
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo $(($(vm_stat | awk '/Pages free/ {print $3}' | sed 's/\.//'  ) * 4096 / 1024 / 1024 / 1024))
    else
        # Unknown OS, return conservative estimate
        echo 4
    fi
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Wait for a service to be ready
wait_for_service() {
    local service_name=$1
    local max_attempts=${2:-30}
    local attempt=1
    
    log_info "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker ps --format '{{.Names}}' | grep -q "$service_name"; then
            local status=$(docker inspect --format='{{.State.Health.Status}}' "$service_name" 2>/dev/null)
            if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
                log_success "$service_name is ready"
                return 0
            fi
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo ""
    log_error "$service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Display a formatted header
print_header() {
    local text=$1
    local width=70
    echo ""
    echo "$(printf '=%.0s' {1..70})"
    echo "  $text"
    echo "$(printf '=%.0s' {1..70})"
    echo ""
}

# Display a formatted section
print_section() {
    local text=$1
    echo ""
    echo "$(printf -- '-%.0s' {1..70})"
    echo "  $text"
    echo "$(printf -- '-%.0s' {1..70})"
}


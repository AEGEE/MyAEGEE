#!/bin/bash
# Common functions for MyAEGEE Ubuntu setup scripts
# Source this file: source scripts-ubuntu/common.sh

set -euo pipefail

# Colors for output
readonly COLOR_RESET='\033[0m'
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_CYAN='\033[0;36m'

# Log functions
log_info() {
    echo -e "${COLOR_CYAN}ℹ INFO:${COLOR_RESET} $*"
}

log_success() {
    echo -e "${COLOR_GREEN}✓${COLOR_RESET} $*"
}

log_warning() {
    echo -e "${COLOR_YELLOW}⚠ WARNING:${COLOR_RESET} $*"
}

log_error() {
    echo -e "${COLOR_RED}✗ ERROR:${COLOR_RESET} $*" >&2
}

log_step() {
    echo -e "\n${COLOR_BLUE}==>${COLOR_RESET} ${COLOR_BLUE}$*${COLOR_RESET}\n"
}

# Error handling
die() {
    log_error "$*"
    exit 1
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running as root
is_root() {
    [ "$(id -u)" -eq 0 ]
}

# Check if user has sudo access
has_sudo() {
    sudo -n true 2>/dev/null
}

# Prompt user for yes/no confirmation
# Usage: confirm "Do you want to continue?" && do_something
confirm() {
    local prompt="${1:-Are you sure?}"
    local response
    
    while true; do
        read -r -p "$prompt [y/N] " response
        case "$response" in
            [yY][eE][sS]|[yY]) 
                return 0
                ;;
            [nN][oO]|[nN]|"")
                return 1
                ;;
            *)
                echo "Please answer yes or no."
                ;;
        esac
    done
}

# Check if running on Ubuntu
is_ubuntu() {
    [ -f /etc/os-release ] && grep -q "^ID=ubuntu" /etc/os-release
}

# Get Ubuntu version (e.g., "24.04")
get_ubuntu_version() {
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        echo "$VERSION_ID"
    else
        echo "unknown"
    fi
}

# Check if running Ubuntu 24.04
is_ubuntu_2404() {
    [ "$(get_ubuntu_version)" = "24.04" ]
}

# Get available disk space in GB for given path
get_disk_space_gb() {
    local path="${1:-.}"
    df -BG "$path" | awk 'NR==2 {print $4}' | sed 's/G//'
}

# Check if port is in use
is_port_in_use() {
    local port="$1"
    ss -tuln | grep -q ":${port} "
}

# Get process using a port
get_port_process() {
    local port="$1"
    sudo ss -tulnp 2>/dev/null | grep ":${port} " | awk '{print $7}' | head -n1
}

# Version comparison (returns 0 if version1 >= version2)
version_ge() {
    local version1="$1"
    local version2="$2"
    
    # Use sort -V for version-aware sorting
    printf '%s\n%s\n' "$version2" "$version1" | sort -V -C
}

# Extract version number from string
# Usage: extract_version "Docker version 24.0.7, build afdd53b"
extract_version() {
    echo "$1" | grep -oP '\d+\.\d+(\.\d+)?' | head -n1
}

# Check if Docker is installed and meets minimum version
check_docker_version() {
    local min_version="${1:-24.0}"
    
    if ! command_exists docker; then
        return 1
    fi
    
    local docker_version
    docker_version=$(docker --version | extract_version)
    
    if [ -z "$docker_version" ]; then
        return 1
    fi
    
    version_ge "$docker_version" "$min_version"
}

# Check if Docker Compose V2 is available
check_docker_compose_v2() {
    docker compose version >/dev/null 2>&1
}

# Check if user is in docker group
is_in_docker_group() {
    groups | grep -qw docker
}

# Append to file if content doesn't exist (idempotent)
append_if_missing() {
    local file="$1"
    local marker="$2"
    local content="$3"
    
    if ! grep -qF "$marker" "$file" 2>/dev/null; then
        echo "$content" | sudo tee -a "$file" >/dev/null
        return 0
    else
        return 1
    fi
}

# Create backup of file
backup_file() {
    local file="$1"
    local backup="${file}.backup.$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "$file" ]; then
        sudo cp "$file" "$backup"
        log_info "Backed up $file to $backup"
    fi
}

# Spinner for long-running operations
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    
    while ps -p "$pid" > /dev/null 2>&1; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Run command with loading indicator
run_with_spinner() {
    local message="$1"
    shift
    
    printf "%s... " "$message"
    
    # Run command in background
    "$@" > /tmp/spinner_output 2>&1 &
    local pid=$!
    
    # Show spinner
    spinner $pid
    
    # Wait for command to finish
    wait $pid
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "✓"
    else
        echo "✗"
        cat /tmp/spinner_output
        rm -f /tmp/spinner_output
        return $exit_code
    fi
    
    rm -f /tmp/spinner_output
    return 0
}

# Export functions for use in subshells
export -f log_info log_success log_warning log_error log_step die
export -f command_exists is_root has_sudo confirm
export -f is_ubuntu get_ubuntu_version is_ubuntu_2404
export -f get_disk_space_gb is_port_in_use get_port_process
export -f version_ge extract_version check_docker_version check_docker_compose_v2
export -f is_in_docker_group append_if_missing backup_file
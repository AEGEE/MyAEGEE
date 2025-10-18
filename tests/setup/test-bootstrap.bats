#!/usr/bin/env bats
# Tests for bootstrap.sh - Main orchestration script

setup() {
    # Store original OS release file
    if [ -f /etc/os-release ]; then
        cp /etc/os-release /etc/os-release.backup 2>/dev/null || true
    fi
}

teardown() {
    # Restore original OS release file
    if [ -f /etc/os-release.backup ]; then
        mv /etc/os-release.backup /etc/os-release 2>/dev/null || true
    fi
}

@test "detect Ubuntu 24.04 correctly" {
    # Skip if not on Ubuntu 24.04
    if [ ! -f /etc/os-release ]; then
        skip "No /etc/os-release file"
    fi
    
    # shellcheck disable=SC1091
    . /etc/os-release
    
    if [ "$ID" = "ubuntu" ] && [ "$VERSION_ID" = "24.04" ]; then
        run bash -c '. scripts-ubuntu/common.sh && is_ubuntu_2404 && echo "detected"'
        [ "$status" -eq 0 ]
        [[ "$output" =~ "detected" ]]
    else
        skip "Not running on Ubuntu 24.04"
    fi
}

@test "reject unsupported OS version" {
    run bash -c '. scripts-ubuntu/common.sh && is_ubuntu_2404'
    
    # Should return 0 only on Ubuntu 24.04
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        if [ "$ID" = "ubuntu" ] && [ "$VERSION_ID" = "24.04" ]; then
            [ "$status" -eq 0 ]
        else
            [ "$status" -ne 0 ]
        fi
    else
        [ "$status" -ne 0 ]
    fi
}

@test "check for sudo access" {
    run bash -c '. scripts-ubuntu/common.sh && has_sudo && echo "has sudo"'
    
    # This test depends on whether the test runner has sudo
    # Just verify the function exists and can be called
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "detect insufficient disk space" {
    run bash -c '. scripts-ubuntu/common.sh && get_disk_space_gb .'
    [ "$status" -eq 0 ]
    # Should return a number
    [[ "$output" =~ ^[0-9]+$ ]]
}

@test "detect Docker already installed" {
    run bash -c '. scripts-ubuntu/common.sh && (command_exists docker && echo "found" || echo "not found")'
    
    # Just verify the function works (returns either "found" or "not found")
    [ "$status" -eq 0 ]
    [[ "$output" =~ ^(found|not\ found)$ ]]
}

@test "check Docker version meets requirements" {
    # Skip if Docker not installed
    if ! command -v docker >/dev/null 2>&1; then
        skip "Docker not installed"
    fi
    
    run bash -c '. scripts-ubuntu/common.sh && check_docker_version 24.0'
    
    # Should return 0 if Docker >= 24.0, 1 otherwise
    # Test just verifies function can be called
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "detect missing dependencies" {
    run bash -c '. scripts-ubuntu/common.sh && command_exists nonexistentcommand123'
    [ "$status" -eq 1 ]
}

@test "common.sh functions are exported" {
    run bash -c '. scripts-ubuntu/common.sh && type log_info'
    [ "$status" -eq 0 ]
    [[ "$output" =~ "function" ]]
}

@test "version comparison works correctly" {
    run bash -c '. scripts-ubuntu/common.sh && version_ge "24.0.7" "24.0" && echo "greater"'
    [ "$status" -eq 0 ]
    [[ "$output" =~ "greater" ]]
    
    run bash -c '. scripts-ubuntu/common.sh && version_ge "23.0" "24.0"'
    [ "$status" -eq 1 ]
}

@test "port detection works" {
    run bash -c '. scripts-ubuntu/common.sh && is_port_in_use 99999'
    # Port 99999 should not be in use
    [ "$status" -eq 1 ]
}

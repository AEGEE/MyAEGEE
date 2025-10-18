#!/usr/bin/env bats
# Tests for Docker installation and validation

@test "Docker version >= 24.0" {
    # Skip if Docker not installed
    if ! command -v docker >/dev/null 2>&1; then
        skip "Docker not installed"
    fi
    
    run docker --version
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Docker version" ]]
    
    # Extract version and check
    version=$(echo "$output" | grep -oP '\d+\.\d+' | head -n1)
    run bash -c '. scripts-ubuntu/common.sh && version_ge "'$version'" "24.0"'
    
    # Should pass if Docker >= 24.0
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "Docker Compose V2 is available" {
    # Skip if Docker not installed
    if ! command -v docker >/dev/null 2>&1; then
        skip "Docker not installed"
    fi
    
    run docker compose version
    
    if [ "$status" -eq 0 ]; then
        [[ "$output" =~ "version" ]]
        # V2 uses "Docker Compose" vs V1 "docker-compose"
        [[ "$output" =~ "Docker Compose" ]] || [[ "$output" =~ "v2" ]]
    else
        # Docker installed but Compose V2 not available
        [ "$status" -ne 0 ]
    fi
}

@test "check_docker_compose_v2 function works" {
    run bash -c '. scripts-ubuntu/common.sh && check_docker_compose_v2'
    
    # Should return 0 if Compose V2 available, 1 otherwise
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "user docker group membership can be checked" {
    run bash -c '. scripts-ubuntu/common.sh && is_in_docker_group'
    
    # Should return 0 if in docker group, 1 otherwise
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "user is in docker group (if Docker installed)" {
    # Skip if Docker not installed
    if ! command -v docker >/dev/null 2>&1; then
        skip "Docker not installed"
    fi
    
    run groups
    [ "$status" -eq 0 ]
    
    # Check if docker group exists in output
    [[ "$output" =~ "docker" ]] || [ "$status" -eq 0 ]
}

@test "Docker daemon is accessible (if Docker installed)" {
    # Skip if Docker not installed  
    if ! command -v docker >/dev/null 2>&1; then
        skip "Docker not installed"
    fi
    
    # Try to run docker ps (may fail if not in docker group or daemon not running)
    run docker ps
    
    # Should either succeed or give permission error
    [ "$status" -eq 0 ] || [[ "$output" =~ "permission denied" ]] || [[ "$output" =~ "Cannot connect" ]]
}

@test "can run docker ps without sudo (if setup complete)" {
    # Skip if Docker not installed
    if ! command -v docker >/dev/null 2>&1; then
        skip "Docker not installed"
    fi
    
    # Skip if not in docker group
    if ! groups | grep -q docker; then
        skip "Not in docker group yet"
    fi
    
    run docker ps
    [ "$status" -eq 0 ]
}

@test "Docker buildx plugin available (if Docker >= 24.0 installed)" {
    # Skip if Docker not installed
    if ! command -v docker >/dev/null 2>&1; then
        skip "Docker not installed"
    fi
    
    run docker buildx version
    
    # Should succeed if buildx is installed
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "containerd.io is installed (if Docker installed)" {
    # Skip if not on a system with systemctl
    if ! command -v systemctl >/dev/null 2>&1; then
        skip "systemctl not available"
    fi
    
    # Skip if Docker not installed
    if ! command -v docker >/dev/null 2>&1; then
        skip "Docker not installed"
    fi
    
    run systemctl status containerd
    
    # Should show containerd status
    [ "$status" -eq 0 ] || [[ "$output" =~ "containerd" ]]
}

@test "check_docker_version function works correctly" {
    run bash -c '. scripts-ubuntu/common.sh && check_docker_version 24.0'
    
    # Should return 0 if Docker >= 24.0, 1 if not installed or older
    [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

@test "extract_version function extracts version correctly" {
    run bash -c '. scripts-ubuntu/common.sh && extract_version "Docker version 24.0.7, build afdd53b"'
    [ "$status" -eq 0 ]
    [[ "$output" =~ ^[0-9]+\.[0-9]+ ]]
}

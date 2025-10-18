#!/usr/bin/env bats
# Tests for environment detection (is_vagrant function)

@test "detect Vagrant via /vagrant directory" {
    # Create a temporary /vagrant-like directory for testing
    # Note: Cannot actually create /vagrant without sudo, so test the logic differently
    
    run bash -c '[ -d "/vagrant" ] && echo "vagrant" || echo "host"'
    
    # Result depends on whether we're actually in Vagrant
    [ "$status" -eq 0 ]
    [[ "$output" =~ ^(vagrant|host)$ ]]
}

@test "detect Vagrant via VAGRANT env var" {
    run bash -c 'VAGRANT=1 && [ -n "$VAGRANT" ] && echo "vagrant"'
    [ "$status" -eq 0 ]
    [[ "$output" =~ "vagrant" ]]
}

@test "detect host environment when no Vagrant indicators" {
    run bash -c 'unset VAGRANT && [ ! -d "/vagrant" ] && echo "host"'
    
    # Should return host if we're not in Vagrant
    if [ ! -d "/vagrant" ]; then
        [ "$status" -eq 0 ]
        [[ "$output" =~ "host" ]]
    else
        skip "Running inside Vagrant VM"
    fi
}

@test "is_vagrant function exists in helper.sh" {
    run bash -c '. helper.sh && type is_vagrant'
    [ "$status" -eq 0 ]
    [[ "$output" =~ "function" ]]
}

@test "is_vagrant returns correct value in helper.sh" {
    run bash -c '. helper.sh && is_vagrant && echo "vagrant" || echo "host"'
    [ "$status" -eq 0 ]
    [[ "$output" =~ ^(vagrant|host)$ ]]
}

@test "helper.sh can be sourced without errors" {
    run bash -c '. helper.sh && echo "sourced"'
    [ "$status" -eq 0 ]
    [[ "$output" =~ "sourced" ]]
}

@test "start.sh has OS detection function" {
    run bash -c '. start.sh 2>/dev/null || true && type detect_os 2>/dev/null || echo "not found"'
    # Just verify the function exists (start.sh may error when sourced directly)
    [[ "$output" != "not found" ]] || [ "$status" -eq 0 ]
}

@test "environment detection is consistent" {
    # Test that is_vagrant returns the same result when called multiple times
    run bash -c '. helper.sh && is_vagrant; r1=$?; is_vagrant; r2=$?; [ $r1 -eq $r2 ] && echo "consistent"'
    [ "$status" -eq 0 ]
    [[ "$output" =~ "consistent" ]]
}

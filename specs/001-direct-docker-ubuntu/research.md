# Research & Technical Decisions: Direct Docker on Ubuntu

**Feature**: 001-direct-docker-ubuntu  
**Date**: 2025-10-18  
**Status**: Complete

This document consolidates all technical research and decisions made during Phase 0 planning for enabling direct Docker development on Ubuntu 24.04.

## 1. Docker Installation on Ubuntu 24.04

### Decision

Use official Docker apt repository installation method

### Rationale

- Most reliable source with latest stable versions
- Automatic security updates via apt
- Official support from Docker Inc.
- Consistent across Ubuntu versions
- Well-documented, widely adopted

### Alternatives Considered

- **Snap package**: Rejected due to older versions, snap daemon overhead, confined environment limitations
- **Manual binary installation**: Rejected due to no automatic updates, manual management overhead
- **Docker Desktop for Linux**: Rejected due to unnecessary GUI overhead, desktop-focused features, larger footprint

### Implementation Approach

```bash
# Add Docker's official GPG key
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### References

- https://docs.docker.com/engine/install/ubuntu/
- Ubuntu 24.04 codename: "noble"

---

## 2. Environment Detection Strategy

### Decision

Check for `/vagrant` directory and `VAGRANT` environment variable

### Rationale

- `/vagrant` is always present in Vagrant VMs (shared folder mount point)
- `VAGRANT` environment variable set by Vagrant provisioners
- Simple boolean check with no false positives
- Fast execution, no external dependencies
- Works regardless of VM customization

### Alternatives Considered

- **Check for VirtualBox kernel modules**: Rejected due to false positives (system might use VirtualBox for other VMs)
- **Parse hostname patterns**: Rejected because hostnames are customizable, unreliable indicator
- **Check for vagrant user**: Rejected because user might be renamed or might exist on non-Vagrant systems

### Implementation Approach

```bash
is_vagrant() {
    # Check if running inside Vagrant VM
    if [ -d "/vagrant" ] || [ -n "$VAGRANT" ]; then
        return 0  # true - inside Vagrant
    else
        return 1  # false - direct host
    fi
}

# Usage in scripts
if is_vagrant; then
    echo "Running inside Vagrant VM"
    # Use Vagrant-specific paths and behavior
else
    echo "Running on host system"
    # Use host-specific paths and behavior
fi
```

### Integration Points

- `helper.sh`: Adjust Docker command execution
- `Makefile`: Conditional SSH wrapping
- `start.sh`: Environment selection logic

---

## 3. Docker Group Permission Handling

### Decision

Add user to docker group automatically with permission prompt, require logout/login for activation

### Rationale

- Standard Docker setup procedure recommended by official documentation
- Avoids need for sudo on every docker command (better UX)
- Matches existing Vagrant provisioning approach
- Group permissions are persistent across reboots
- Clear instructions prevent user confusion

### Alternatives Considered

- **Use sudo for all docker commands**: Rejected due to poor user experience, password prompts, sudo session timeouts
- **Use `newgrp` to activate immediately**: Rejected because it spawns a subshell, confusing to users, doesn't persist after terminal close
- **Use Docker rootless mode**: Deferred to future work due to complexity, namespace configuration, compatibility concerns

### Implementation Approach

```bash
# Check if user is in docker group
if ! groups | grep -q '\bdocker\b'; then
    echo "Adding $USER to docker group..."
    sudo usermod -aG docker $USER
    echo ""
    echo "⚠️  IMPORTANT: You must log out and log back in for group changes to take effect."
    echo "    Run 'newgrp docker' to activate in current shell, or log out/in to apply system-wide."
    echo ""
fi
```

### User Communication

Display clear instructions:

1. What was changed (added to docker group)
2. Why it's necessary (run docker without sudo)
3. What user must do (logout/login)
4. Alternative for testing (newgrp docker)

---

## 4. Port Conflict Detection Method

### Decision

Use `ss -tuln` to check listening ports before starting services

### Rationale

- `ss` is modern replacement for deprecated `netstat`
- Installed by default on Ubuntu 24.04
- Shows PID and process name with `-p` flag
- Fast execution, standardized output format
- Part of iproute2 package (core system utility)

### Alternatives Considered

- **`netstat`**: Rejected because deprecated, not installed by default on modern Ubuntu, slower than ss
- **`lsof -i`**: Rejected due to slower execution, more complex output parsing, not all systems have lsof
- **Attempt to bind and catch error**: Rejected due to side effects (creates listening socket), doesn't identify conflicting process

### Implementation Approach

```bash
check_port() {
    local port=$1
    local service_name=$2

    # Check if port is in use
    if ss -tuln | grep -q ":${port} "; then
        # Get process using the port (requires sudo for process info)
        local process=$(sudo ss -tulnp | grep ":${port} " | awk '{print $7}')
        echo "⚠️  Port $port (needed for $service_name) is already in use by: $process"
        echo "    You can:"
        echo "    1. Stop the conflicting service"
        echo "    2. Configure MyAEGEE to use a different port"
        return 1
    fi
    return 0
}

# Check common ports
check_port 80 "Traefik HTTP" || CONFLICTS=true
check_port 443 "Traefik HTTPS" || CONFLICTS=true
check_port 5432 "PostgreSQL" || CONFLICTS=true

if [ "$CONFLICTS" = "true" ]; then
    echo ""
    echo "Port conflicts detected. Resolve them before continuing."
    exit 1
fi
```

### Ports to Check

- 80: Traefik HTTP
- 443: Traefik HTTPS
- 5432: PostgreSQL (multiple instances for different services)
- 6379: Redis (if enabled)
- 9090: Prometheus (if monitoring enabled)

---

## 5. Hot Reload Implementation

### Decision

Use Docker bind mounts for source code, rely on existing service hot reload mechanisms

### Rationale

- Bind mounts are native Docker feature with zero overhead
- Services already support hot reload (nodemon, Vue dev server, mix phx.server)
- No additional tooling required
- Works for 90% of file types (code, config, templates)
- Direct file system access for debugging

### Alternatives Considered

- **Docker volumes with sync tools (docker-sync, mutagen)**: Rejected due to added complexity, performance overhead, extra dependencies
- **Code changes require rebuild**: Rejected due to poor developer experience, slow iteration (60+ second rebuild)
- **Remote development over SSH**: Rejected as out of scope, different use case

### Implementation Approach

```yaml
# docker-compose.dev.yml (already exists, verify bind mounts)
services:
  core:
    volumes:
      - ./core:/usr/app/core:cached # Source code bind mount
      - /usr/app/core/node_modules # Exclude node_modules
```

### inotify Limits

On Linux, file watchers are limited by `fs.inotify.max_user_watches`. Increase for large codebases:

```bash
# Check current limit
cat /proc/sys/fs/inotify/max_user_watches

# Increase limit (temporary)
sudo sysctl fs.inotify.max_user_watches=524288

# Make permanent
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Validation

Test hot reload for each service type:

- Node.js (nodemon): Edit lib/server.js, check auto-restart
- Vue (webpack-dev-server): Edit src/components, check HMR
- Elixir (Phoenix): Edit lib/mailer, check code reload

---

## 6. Testing Framework for Setup Scripts

### Decision

Use bats (Bash Automated Testing System) for script validation

### Rationale

- Purpose-built for Bash script testing
- TAP (Test Anything Protocol) output format
- Easy to read and write test cases
- Wide adoption in DevOps community
- Simple assertion syntax
- Good error reporting

### Alternatives Considered

- **ShellSpec**: Rejected due to less adoption, more complex DSL, fewer examples
- **Manual test scripts**: Rejected due to no structure, hard to maintain, no test reporting
- **No testing**: Rejected as violation of Test-Driven Quality principle (Constitution)

### Implementation Approach

```bash
# Install bats
sudo apt-get install bats

# Or install from source for latest version
git clone https://github.com/bats-core/bats-core.git
cd bats-core
sudo ./install.sh /usr/local

# Test file structure
tests/setup/test-bootstrap.bats
```

### Example Test

```bash
#!/usr/bin/env bats

@test "detect Ubuntu 24.04" {
    run scripts-ubuntu/check-prerequisites.sh --detect-os
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Ubuntu 24.04" ]]
}

@test "check for Docker installation" {
    run scripts-ubuntu/check-prerequisites.sh --check-docker
    # Should pass if Docker installed, fail with message if not
}

@test "environment detection identifies Vagrant correctly" {
    export VAGRANT=1
    run bash -c 'source helper.sh; is_vagrant && echo "vagrant" || echo "host"'
    [ "$output" = "vagrant" ]
}
```

### CI Integration

Add to CircleCI config for automated validation:

```yaml
test-setup-scripts:
  docker:
    - image: ubuntu:24.04
  steps:
    - checkout
    - run: apt-get update && apt-get install -y bats
    - run: bats tests/setup/
```

---

## 7. /etc/hosts Management

### Decision

Append entries if missing, preserve existing content, require sudo, use marker comments for idempotency

### Rationale

- Safe and non-destructive (append-only)
- Standard practice for local development DNS
- Works with all tools (browser, CLI, services)
- No additional daemons or dependencies
- Survives reboots

### Alternatives Considered

- **dnsmasq/systemd-resolved configuration**: Rejected as overkill, extra complexity, one more daemon to manage
- **Browser extensions**: Rejected because doesn't work for CLI tools, API calls from containers
- **Hardcode IPs in configs**: Rejected as violation of Configuration via Environment principle

### Implementation Approach

```bash
setup_hosts() {
    local marker_start="# MyAEGEE local development - START"
    local marker_end="# MyAEGEE local development - END"
    local hosts_file="/etc/hosts"

    # Check if entries already exist
    if grep -q "$marker_start" "$hosts_file"; then
        echo "✓ /etc/hosts entries already configured"
        return 0
    fi

    echo "Configuring /etc/hosts for local development..."
    echo "This requires sudo access."

    # Append entries
    sudo tee -a "$hosts_file" > /dev/null <<EOF

$marker_start
127.0.0.1 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test pgadmin.appserver.test
$marker_end
EOF

    echo "✓ /etc/hosts configured"
}
```

### Entries Required

- `appserver.test`: Base domain
- `my.appserver.test`: Frontend
- `traefik.appserver.test`: Traefik dashboard
- `portainer.appserver.test`: Portainer (dev tools)
- `pgadmin.appserver.test`: pgAdmin (dev tools)

### Removal (Optional)

Provide cleanup script:

```bash
# Remove MyAEGEE entries from /etc/hosts
sudo sed -i '/# MyAEGEE local development - START/,/# MyAEGEE local development - END/d' /etc/hosts
```

---

## 8. Migration Tool Data Preservation

### Decision

Use `docker cp` to export Vagrant VM volumes, import to named Docker volumes

### Rationale

- Standard Docker approach for volume backup/restore
- Preserves file permissions and ownership
- Atomic operation (tar archive)
- Works even if containers are stopped
- Service-agnostic (works for databases, uploaded files, etc.)

### Alternatives Considered

- **Database dumps/restores**: Rejected as incomplete (doesn't handle uploaded files, media), service-specific logic needed
- **rsync between VM and host**: Rejected due to complexity, requires VM running, permission issues
- **Manual backup instructions only**: Rejected due to error-prone process, low adoption rate

### Implementation Approach

```bash
migrate_vagrant_data() {
    echo "Migrating data from Vagrant to direct Docker..."

    # 1. Ensure Vagrant VM is running
    vagrant up

    # 2. Export volumes from Vagrant VM
    vagrant ssh -c "
        cd /vagrant
        for service in core events statutory summeruniversity; do
            # Find volume container
            VOLUME_CONTAINER=\$(docker-compose ps -q postgres-\${service})
            if [ -n \"\$VOLUME_CONTAINER\" ]; then
                # Export volume data
                docker run --rm \
                    --volumes-from \$VOLUME_CONTAINER \
                    -v /vagrant:/backup \
                    alpine tar czf /backup/\${service}-db-backup.tar.gz /var/lib/postgresql/data
            fi
        done
    "

    # 3. Stop Vagrant to avoid conflicts
    vagrant halt

    # 4. Import to host Docker volumes
    for service in core events statutory summeruniversity; do
        if [ -f "${service}-db-backup.tar.gz" ]; then
            # Create named volume
            docker volume create myaegee_${service}_data

            # Import data
            docker run --rm \
                -v myaegee_${service}_data:/data \
                -v $(pwd):/backup \
                alpine sh -c "cd /data && tar xzf /backup/${service}-db-backup.tar.gz --strip 1"

            # Cleanup archive
            rm "${service}-db-backup.tar.gz"
        fi
    done

    echo "✓ Migration complete"
}
```

### Data Types to Migrate

1. **PostgreSQL databases**: Core user data, events, statutory meetings
2. **Uploaded files**: User avatars, event images, statutory documents
3. **Configuration**: .env customizations (manual comparison)

### Validation

After migration, verify:

- Test users exist and can login
- Events are visible
- Uploaded images display correctly
- Service logs show no errors

### Rollback

Original Vagrant VM remains untouched. If migration fails:

```bash
vagrant up
# Continue using Vagrant
```

---

## Summary of Technical Stack

### Languages & Tools

- **Bash 5.x**: Setup and orchestration scripts
- **Docker Engine 24.0+**: Container runtime
- **Docker Compose V2**: Multi-container orchestration
- **Make**: Build automation
- **bats**: Script testing
- **Git**: Version control, submodule management

### System Requirements

- **OS**: Ubuntu 24.04 LTS (x86_64)
- **RAM**: 8GB minimum (6GB for services + 2GB for system)
- **Disk**: 20GB free (15GB for Docker images + 5GB for databases)
- **CPU**: 4 cores minimum (for reasonable build times)
- **Network**: Unrestricted access to Docker Hub, GitHub Container Registry

### Key Dependencies

- docker-ce, docker-ce-cli, containerd.io
- docker-compose-plugin (Compose V2)
- build-essential, make, git, curl
- ca-certificates, gnupg, apt-transport-https

### Configuration Files

- `.env`: Service configuration (unchanged)
- `/etc/hosts`: DNS entries for local development
- `/etc/sysctl.conf`: inotify limits (optional optimization)
- `docker-compose.yml` + `docker-compose.dev.yml`: Service definitions (unchanged)

---

## Next Steps

1. **Phase 1**: Create quickstart.md with step-by-step Ubuntu setup instructions
2. **Phase 1**: Update README.md with direct Docker section
3. **Phase 2**: Generate tasks.md breaking down implementation into actionable items
4. **Implementation**: Create scripts in scripts-ubuntu/ directory
5. **Testing**: Write bats tests for all scripts
6. **Documentation**: Comprehensive troubleshooting guide
7. **Validation**: Test on fresh Ubuntu 24.04 VM

---

**Phase 0 Complete** - All technical decisions documented and justified. Ready for Phase 1 artifact generation.

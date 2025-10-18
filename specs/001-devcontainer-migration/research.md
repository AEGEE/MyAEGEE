# Research: Dev Container Migration

**Date**: 2025-10-18  
**Feature**: 001-devcontainer-migration

## Overview

This document consolidates research findings for migrating from Vagrant to Dev Containers and GitHub Codespaces for MyAEGEE development environment.

---

## Decision 1: Dev Container Base Image

**Decision**: Use `mcr.microsoft.com/devcontainers/base:ubuntu-22.04` as base image

**Rationale**:

- Official Microsoft dev container images with long-term support
- Ubuntu 22.04 LTS matches current Vagrant box (ubuntu-18.04 → upgrade path)
- Pre-configured with common development tools (git, curl, wget, etc.)
- Optimized for VS Code dev containers with proper user permissions
- Supports both x86_64 and ARM64 (M1/M2 Macs)

**Alternatives Considered**:

- `ubuntu:22.04` - Requires manual setup of dev container essentials
- `node:18-bullseye` - Too specific to Node.js, MyAEGEE has multiple service types
- Custom built image - Unnecessary complexity for initial implementation

**References**:

- https://github.com/devcontainers/images/tree/main/src/base-ubuntu
- https://containers.dev/guide/dockerfile

---

## Decision 2: Service Orchestration Strategy

**Decision**: Use `dockerComposeFile` in devcontainer.json pointing to modified docker-compose setup

**Rationale**:

- Leverages existing docker-compose infrastructure in MyAEGEE
- Allows running multiple services with dependencies (databases, backends, frontend)
- Dev Containers extension natively supports docker-compose
- Preserves service isolation and existing container definitions
- Enables gradual migration without rewriting service configurations

**Alternatives Considered**:

- Single monolithic container - Violates microservices architecture principle
- Kubernetes/K3s - Excessive complexity for local development
- Manual docker run commands - Difficult to manage dependencies and ordering

**Implementation Pattern**:

```yaml
# .devcontainer/devcontainer.json
{
  "name": "MyAEGEE Dev",
  "dockerComposeFile":
    ["../base-docker-compose.yml", "docker-compose.devcontainer.yml"],
  "service": "workspace",
  "workspaceFolder": "/workspace",
}
```

**References**:

- https://code.visualstudio.com/docs/devcontainers/create-dev-container#_use-docker-compose
- https://containers.dev/implementors/json_reference/#compose-specific

---

## Decision 3: Port Mapping Strategy

**Decision**: Map services to non-privileged ports (3000+) and document in startup message

**Rationale**:

- Avoids conflicts with system services on ports 80/443
- No root privileges required for port binding
- GitHub Codespaces automatically forwards all exposed ports
- Consistent with industry standards (React default: 3000, etc.)
- Clear separation from production port expectations

**Port Assignments**:

- Frontend: 3000 (main application entry point)
- Traefik Dashboard: 8080 (reverse proxy admin)
- Portainer: 9000 (container management UI)
- pgAdmin: 5050 (database admin UI)
- Core API: 8084
- Events API: 8085
- Statutory API: 8086
- Discounts API: 8087
- Knowledge API: 8088
- Summeruniversity API: 8089
- Network API: 8090
- Mailer API: 8091 (Elixir/Phoenix)
- GSuite Wrapper API: 8092
- PostgreSQL: 5432 (internal only)
- Redis: 6379 (internal only)

**Note**: Gateways and dev-tools use Traefik routing internally and don't require dedicated external ports in dev containers.

**Alternatives Considered**:

- Keep ports 80/443 - Requires root, conflicts common
- Random/dynamic ports - Poor developer experience
- Traefik subdomain routing in containers - Complex, doesn't work in Codespaces

**References**:

- https://docs.github.com/en/codespaces/developing-in-codespaces/forwarding-ports-in-your-codespace

---

## Decision 4: Dependency Startup Ordering

**Decision**: Use docker-compose `depends_on` with healthchecks and wait-for-it script

**Rationale**:

- Docker Compose v3.4+ supports health check-based dependency waiting
- Existing services already have health check endpoints
- Prevents race conditions where backend starts before database ready
- Clear error messages when dependencies fail health checks
- Industry standard approach for service orchestration

**Implementation Approach**:

```yaml
services:
  core:
    depends_on:
      postgres-core:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8084/healthcheck"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**Alternatives Considered**:

- No ordering - Leads to startup failures and confusion
- Manual restart by developers - Poor UX, error-prone
- Custom orchestration script - Reinventing docker-compose functionality
- Kubernetes init containers - Overkill for local development

**References**:

- https://docs.docker.com/compose/compose-file/05-services/#depends_on
- https://docs.docker.com/compose/compose-file/05-services/#healthcheck

---

## Decision 5: Database Persistence

**Decision**: Use named Docker volumes with devcontainer.json `mounts` configuration

**Rationale**:

- Docker volumes persist across container rebuilds
- Better performance than bind mounts for database files
- Works consistently across Windows/macOS/Linux
- Volumes can be easily listed, backed up, and deleted
- Survives container deletion (only removed with `docker volume rm`)

**Volume Strategy**:

- One volume per database: `myaegee-core-db`, `myaegee-events-db`, etc.
- Volumes mounted at standard PostgreSQL data directory: `/var/lib/postgresql/data`
- Reset command: `docker volume rm myaegee-*-db` + restart

**Alternatives Considered**:

- Bind mounts to host - Performance issues on macOS/Windows
- No persistence - Data loss on restart unacceptable
- Single shared volume - Violates microservices data ownership
- SQL dump/restore only - Too slow for frequent resets

**References**:

- https://docs.docker.com/storage/volumes/
- https://code.visualstudio.com/remote/advancedcontainers/add-local-file-mount

---

## Decision 6: Resource Adaptation Strategy

**Decision**: Implement startup script that detects available RAM and offers minimal mode

**Rationale**:

- Graceful degradation improves accessibility (developers with 8GB machines)
- Clear messaging prevents confusion about missing services
- Minimal mode (frontend + core + 1 DB) still provides working environment
- Optional, not forced - developers with resources can run full mode
- Aligns with constitution principle of user-focused development

**Detection Method**:

```bash
# In post-start.sh
AVAILABLE_RAM=$(free -g | awk '/^Mem:/{print $7}')
if [ "$AVAILABLE_RAM" -lt 6 ]; then
  echo "⚠️  Detected limited RAM. Start in minimal mode? (y/n)"
fi
```

**Minimal Mode Services**:

- Frontend (essential for development)
- Core microservice (authentication, users, bodies - used by all features)
- Single PostgreSQL instance
- Skip: events, statutory, discounts, portainer, pgadmin, traefik

**Alternatives Considered**:

- Fixed 4GB limit - Too strict, doesn't adapt to available resources
- No adaptation - Poor experience for developers with constrained machines
- Automatic minimal mode - Surprising behavior, no developer control
- Resource limits per container - Complex, requires manual tuning

**References**:

- https://www.kernel.org/doc/Documentation/filesystems/proc.txt (meminfo)

---

## Decision 7: Configuration Management

**Decision**: Auto-generate localhost-based URLs in .env during container startup

**Rationale**:

- Developers don't need to manually edit configuration
- Localhost URLs work identically in local dev containers and Codespaces
- Existing .env infrastructure can be leveraged
- Startup script can detect environment (local vs Codespaces) and adapt
- Prevents "works on my machine" configuration issues

**Configuration Approach**:

```bash
# In post-create.sh
cat > .env.devcontainer << EOF
BASE_URL=localhost
SUBDOMAIN_FRONTEND=http://localhost:3000
SUBDOMAIN_CORE=http://localhost:8084
# ... other services
EOF
```

**Alternatives Considered**:

- Hardcode localhost URLs - Not flexible for port changes
- Require manual .env editing - Violates "zero configuration" goal
- Use environment variables only - Harder to debug and override
- Traefik subdomain routing - Doesn't work in Codespaces

**References**:

- VS Code Dev Containers: https://code.visualstudio.com/docs/devcontainers/containers#_environment-variables

---

## Decision 8: GitHub Codespaces Optimization

**Decision**: Configure prebuild for faster Codespace creation

**Rationale**:

- Prebuilds can reduce startup time from 10-15 min to 2-3 min
- GitHub Actions builds container image and caches layers
- Developers get faster feedback when creating Codespaces
- Cost-effective: prebuilds run on schedule, not per-developer
- Better first-impression for new contributors

**Prebuild Configuration**:

```yaml
# .github/workflows/codespaces-prebuild.yml
name: Codespaces Prebuild
on:
  push:
    branches: [main, develop]
  workflow_dispatch:
```

**Alternatives Considered**:

- No prebuild - Slower Codespace creation, poor UX
- Manual prebuild triggers - Requires maintainer intervention
- Prebuild on every commit - Expensive, unnecessary

**References**:

- https://docs.github.com/en/codespaces/prebuilding-your-codespaces/about-github-codespaces-prebuilds

---

## Decision 9: Hot Reload Support

**Decision**: Mount workspace as bind mount with proper file watching configuration

**Rationale**:

- Developers expect code changes to reflect immediately
- Frontend (Vue.js) and backend (Nodemon) already support hot reload
- Bind mount provides real-time file sync between host and container
- Works consistently across VS Code local and Codespaces
- Maintains existing hot reload infrastructure in services

**Configuration**:

```json
// .devcontainer/devcontainer.json
{
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspace,type=bind,consistency=cached",
  "workspaceFolder": "/workspace"
}
```

**File Watching Considerations**:

- Linux: inotify works natively
- macOS/Windows: Docker Desktop handles file watching
- Increase inotify limits if needed: `fs.inotify.max_user_watches=524288`

**Alternatives Considered**:

- Copy files into container - No hot reload, terrible DX
- Volume mount - Slower than bind mount, same capabilities
- Remote editing - Complicates workflow, not standard in VS Code

**References**:

- https://code.visualstudio.com/remote/advancedcontainers/improve-performance#_use-clone-repository-in-container-volume

---

## Decision 10: Backward Compatibility with Vagrant

**Decision**: Keep Vagrant setup unchanged, add dev container as alternative

**Rationale**:

- Constitution principle: avoid breaking existing workflows
- Some developers may prefer Vagrant or have it working
- Testing/CI might rely on Vagrant setup
- Migration risk mitigation: developers can fall back if issues arise
- Documentation can guide developers to choose preferred method

**Coexistence Strategy**:

- No modifications to Vagrantfile or vagrant provisioning scripts
- Dev container uses different ports to avoid conflicts if both run
- Documentation clearly separates "Dev Container Setup" vs "Vagrant Setup"
- Eventually deprecate Vagrant after dev container proves stable (future feature)

**Alternatives Considered**:

- Remove Vagrant immediately - High risk, breaks existing workflows
- Migrate Vagrant users forcefully - Poor developer experience
- Maintain feature parity - Unnecessary complexity

**References**:

- Feature spec FR-014: "System MUST maintain backward compatibility"

---

## Best Practices Summary

### Dev Container Configuration

- Use official base images when available
- Leverage docker-compose for multi-service orchestration
- Configure health checks for all services
- Use named volumes for database persistence
- Auto-detect and adapt to resource constraints

### Port Management

- Use non-privileged ports (1024+)
- Document port mappings prominently in README and startup message
- Keep internal services on internal network (PostgreSQL, Redis)
- Test port accessibility in both local and Codespaces

### Developer Experience

- Zero manual configuration required
- Clear error messages and troubleshooting guidance
- Fast startup times (target: <2 min for services ready)
- Hot reload working out of the box
- Easy database reset command

### Performance Optimization

- Use GitHub Codespaces prebuilds
- Optimize Dockerfile layers for caching
- Use bind mounts with `cached` consistency mode
- Minimal base images to reduce build time

### Testing Strategy

- Test on all platforms: Windows, macOS, Linux
- Test in GitHub Codespaces
- Test minimal and full service modes
- Test database persistence across restarts
- Test port conflict scenarios

---

## Implementation Checklist

- [ ] Create `.devcontainer/` directory structure
- [ ] Write `devcontainer.json` with docker-compose configuration
- [ ] Create `docker-compose.devcontainer.yml` with service definitions
- [ ] Implement `post-create.sh` script (runs once on container creation)
- [ ] Implement `post-start.sh` script (runs on every start, health checks)
- [ ] Configure port mappings for all services
- [ ] Set up Docker volumes for database persistence
- [ ] Implement resource detection and minimal mode logic
- [ ] Create startup message with service access URLs
- [ ] Update README.md with dev container setup instructions
- [ ] Create separate dev-setup-devcontainer.md guide
- [ ] Configure VS Code extensions in devcontainer.json
- [ ] Test on Windows, macOS, and Linux
- [ ] Test in GitHub Codespaces
- [ ] Document database reset procedure
- [ ] Create troubleshooting guide for common issues

---

## Open Questions

None - all unknowns from Technical Context have been resolved through research.

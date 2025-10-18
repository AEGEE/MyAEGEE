# MyAEGEE Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-19

## Active Technologies

- Shell scripting (Bash), YAML/JSON (devcontainer.json, docker-compose.yml) + Docker Engine/Desktop, VS Code Dev Containers extension, docker-compose, existing MyAEGEE docker infrastructure (001-devcontainer-migration)
- Node.js 18.x LTS, Vue.js 2.x/3.x, PostgreSQL 10.x
- Docker Compose 3.8, Traefik v1.7 (reverse proxy)
- Microservices architecture (12 services: core, events, statutory, discounts, knowledge, summeruniversity, network, mailer, gsuite-wrapper, frontend, gateways, dev-tools)

## Project Structure

```
.devcontainer/          # Dev container configuration
  Dockerfile            # Container image definition
  devcontainer.json     # VS Code dev container config
  docker-compose.devcontainer.yml  # Docker Compose for dev container
  scripts/              # Automation scripts
    utils.sh            # Common utility functions
    health-check.sh     # Service health validation
    post-create.sh      # One-time setup (runs once)
    post-start.sh       # Startup automation (runs every start)
    validate-setup.sh   # Prerequisites validation
    validate-performance.sh  # Performance testing
core/                   # Core microservice (user management, auth)
events/                 # Events microservice
statutory/              # Statutory microservice
discounts/              # Discounts microservice
knowledge/              # Knowledge base microservice
summeruniversity/       # Summer University microservice
network/                # Network microservice
mailer/                 # Mail service
gsuite-wrapper/         # GSuite integration
frontend/               # Vue.js frontend application
docs/                   # Documentation
  dev-setup-devcontainer.md  # Dev container setup guide
  dev-setup-vagrant.md       # Vagrant setup guide (legacy)
  troubleshooting-devcontainer.md  # Troubleshooting reference
```

## Dev Container Development

### Setup Workflow

**First time**:

```bash
# On HOST: Clone and open in VS Code
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
code MyAEGEE

# VS Code: Reopen in Container
# Command Palette → "Dev Containers: Reopen in Container"

# Container will automatically:
# 1. Build image (~5-10 minutes first time)
# 2. Run post-create.sh (one-time setup)
# 3. Run post-start.sh (start services, ~2 minutes)
```

**Subsequent starts**:

- Container automatically starts services via post-start.sh
- Services healthy within 2 minutes (SC-004 requirement)

### Common Commands

Shell aliases pre-configured:

```bash
# Service management (make)
mstart      # make start - Start all services
mstop       # make stop - Stop all services
mrestart    # make restart - Restart services
mlogs       # make monitor - View all service logs
mstatus     # make list - List service status

# Service management (helper.sh)
hstart      # ./helper.sh --start
hstop       # ./helper.sh --stop
hlogs       # ./helper.sh --monitor
hexec       # ./helper.sh --execute <service> <command>

# Docker shortcuts
dps         # docker ps (formatted table)
dlogs       # docker-compose logs -f --tail=100
dstop       # docker-compose stop
drestart    # docker-compose restart

# Health & diagnostics
health      # Run health-check.sh - show service status
.devcontainer/scripts/validate-setup.sh      # Check prerequisites
.devcontainer/scripts/validate-performance.sh  # Run performance tests

# Database management
make reset-db              # Reset all databases
make reset-db-minimal      # Reset with minimal seed data
make reset-db-core         # Reset only core database
make reset-db-events       # Reset only events database
# ... (reset targets for each service)

# Navigation shortcuts
cdcore      # cd /workspace/core
cdevents    # cd /workspace/events
cdstatutory # cd /workspace/statutory
cdfrontend  # cd /workspace/frontend
```

### Architecture Patterns

**Host Networking Mode**:

- Container uses `network_mode: host`
- Services accessible at `localhost:PORT` directly
- No port mapping required
- Simpler than bridge networking

**Docker-in-Docker**:

- Workspace container mounts host Docker socket
- Can control all MyAEGEE service containers
- Services started via `helper.sh` or `make start`

**Service Control**:

```bash
# Control which services run
export ENABLED_SERVICES="core:frontend:events"  # Minimal mode
export ENABLED_SERVICES=""  # Full mode (all 12 services)

make restart  # Apply changes
```

**File Mounting**:

- Repository: `/workspace` inside container
- Changes on HOST immediately visible in container
- Hot reload active (changes visible <3 seconds, SC-005)

### Script Development

**Utilities** (source in scripts):

```bash
source .devcontainer/scripts/utils.sh

# Logging functions
log_info "Starting process..."
log_success "Completed successfully!"
log_warning "Potential issue detected"
log_error "Critical error occurred"

# RAM detection
AVAILABLE_RAM=$(get_available_ram_gb)
if [ "$AVAILABLE_RAM" -lt 4 ]; then
    log_error "Insufficient RAM: ${AVAILABLE_RAM}GB (minimum: 4GB)"
fi

# Service waiting
wait_for_service "http://localhost:8084/healthcheck" 60 "Core API"

# Command checking
if command_exists docker; then
    log_success "Docker is available"
fi
```

**Health Checks**:

```bash
source .devcontainer/scripts/health-check.sh

# Check database
check_postgres_health "postgres-core" 5432 "oms-core-db"

# Check HTTP service
check_http_health "http://localhost:8084/healthcheck" "Core API"

# Check container
check_container_running "myaegee_core_1"

# Wait for all databases
wait_for_databases

# Display status table
display_service_status
```

**Error Handling**:

```bash
#!/bin/bash
set -e  # Exit on error

# Always source utils for consistent logging
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Trap errors for cleanup
cleanup() {
    log_warning "Script interrupted, cleaning up..."
    # cleanup code
}
trap cleanup EXIT ERR
```

### Port Forwarding

Dev container forwards these ports:

| Port | Service           | Access URL            |
| ---- | ----------------- | --------------------- |
| 3000 | Frontend          | http://localhost:3000 |
| 8080 | Traefik Dashboard | http://localhost:8080 |
| 8084 | Core API          | http://localhost:8084 |
| 8085 | Events API        | http://localhost:8085 |
| 8086 | Statutory API     | http://localhost:8086 |
| 8087 | Discounts API     | http://localhost:8087 |
| 8088 | Knowledge API     | http://localhost:8088 |
| 8089 | Summer Uni API    | http://localhost:8089 |
| 8090 | Network API       | http://localhost:8090 |
| 8091 | Mailer API        | http://localhost:8091 |
| 8092 | GSuite Wrapper    | http://localhost:8092 |
| 9000 | Portainer         | http://localhost:9000 |
| 5050 | pgAdmin           | http://localhost:5050 |

### Database Management

**7 PostgreSQL databases** (named volumes):

- `postgres-core-db` - Core service
- `postgres-events-db` - Events service
- `postgres-statutory-db` - Statutory service
- `postgres-discounts-db` - Discounts service
- `postgres-network-db` - Network service
- `postgres-summeruniversity-db` - SU service
- `postgres-knowledge-db` - Knowledge service

**Persistence**:

- Data persists across container rebuilds
- Volumes stored in Docker (not workspace)
- Survives `docker-compose down`

**Reset Commands**:

```bash
# Reset all databases
make reset-db

# Reset with minimal seed data
make reset-db-minimal

# Reset specific database
make reset-db-core
make reset-db-events
# ... etc
```

**Seed Profiles**:

- `default`: Full test data (users, events, applications)
- `minimal`: Essential data only (basic users, structure)
- `custom`: Define your own

Set in `.env`:

```bash
SEED_PROFILE=minimal  # Use minimal seed data
```

### Performance Targets

Specifications from SC-004, SC-005, SC-009:

| Metric           | Target     | Test Command                                                   |
| ---------------- | ---------- | -------------------------------------------------------------- |
| Startup time     | <2 minutes | Measured automatically in post-start.sh                        |
| Hot reload       | <3 seconds | `.devcontainer/scripts/validate-performance.sh hot-reload`     |
| Full mode RAM    | <4GB       | `.devcontainer/scripts/validate-performance.sh full-memory`    |
| Minimal mode RAM | <2GB       | `.devcontainer/scripts/validate-performance.sh minimal-memory` |

**Run all tests**:

```bash
.devcontainer/scripts/validate-performance.sh --all
```

### Minimal Mode

For low-RAM machines (4-6GB):

**Auto-suggested**: Interactive prompt during startup
**Manual activation**:

```bash
# Edit .env
ENABLED_SERVICES=core:frontend

# Or temporary
export ENABLED_SERVICES=core:frontend
make restart
```

**Services in minimal mode**:

- ✅ Core API (users, authentication)
- ✅ Frontend (Vue.js app)
- ✅ Required databases (postgres-core)
- ❌ All other services disabled

**Memory savings**: ~2GB (from 4GB to 2GB)

## Code Style

### Shell Scripts (Bash)

```bash
#!/bin/bash
set -e  # Exit on error

# Source utilities first
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Use log functions for output
log_info "Starting process..."

# Functions with descriptive names
check_prerequisites() {
    local required_ram=4
    local available_ram=$(get_available_ram_gb)

    if [ "$available_ram" -lt "$required_ram" ]; then
        log_error "Insufficient RAM"
        return 1
    fi

    log_success "Prerequisites met"
    return 0
}

# Call functions
check_prerequisites || exit 1
```

**Conventions**:

- Use `set -e` for error handling
- Source `utils.sh` for common functions
- Use `log_*()` functions, not `echo`
- Quote variables: `"$var"` not `$var`
- Use `local` for function variables
- Return 0 (success) or 1 (failure)

### YAML/JSON

**devcontainer.json**:

```jsonc
{
  // Use comments to explain WHY, not WHAT
  "name": "MyAEGEE Development",

  // Explain architecture decisions
  "dockerComposeFile": "docker-compose.devcontainer.yml", // Using compose for multi-container setup

  // Group related settings
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint", // JavaScript linting
        "editorconfig.editorconfig" // Cross-platform consistency
      ]
    }
  }
}
```

**docker-compose.yml**:

```yaml
# File header explaining purpose
# MyAEGEE Dev Container - Docker Compose Configuration

services:
  workspace:
    # Explain non-obvious choices
    network_mode: host # Simpler than bridge, direct localhost access

    volumes:
      # Explain each volume's purpose
      - ..:/workspace:cached # Repository mount (cached for performance)
      - /var/run/docker.sock:/var/run/docker.sock # Docker-in-Docker access
```

## Troubleshooting

### Quick Diagnostics

```bash
# Check Docker
docker ps
docker stats

# Check services
health
make monitor

# Check resources
free -g  # RAM
df -h    # Disk space

# View logs
cat .devcontainer/logs/post-start-*.log
```

### Common Issues

**Services won't start**:

```bash
# Check Docker daemon
docker ps

# View startup logs
make monitor

# Try manual start
make stop && make start
```

**Port conflicts**:

```bash
# Find what's using port
lsof -i :3000

# Kill process
kill <PID>
```

**Out of memory**:

```bash
# Use minimal mode
export ENABLED_SERVICES=core:frontend
make restart

# Or increase Docker memory
# Docker Desktop → Settings → Resources → Memory: 8GB+
```

**Database issues**:

```bash
# Reset database
make reset-db-core

# Check database is running
docker ps | grep postgres-core

# Check connectivity
docker exec myaegee_postgres-core_1 pg_isready -U postgres
```

For comprehensive troubleshooting, see: `docs/troubleshooting-devcontainer.md`

## Recent Changes

- 001-devcontainer-migration: Added complete VS Code Dev Containers support with automated setup, service management, database persistence, minimal mode, GitHub Codespaces support, performance validation, and comprehensive documentation

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

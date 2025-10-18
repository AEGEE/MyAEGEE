# Dev Container Scripts

This directory contains automation scripts for the MyAEGEE dev container setup.

## Scripts Overview

### `utils.sh`

**Purpose**: Common utility functions used by all other scripts

**Functions**:

- `log_info()`, `log_success()`, `log_warning()`, `log_error()` - Color-coded console output
- `get_available_ram_gb()` - Detects available RAM (Linux/macOS/fallback)
- `wait_for_service()` - Polls service with retry logic
- `command_exists()` - Checks if command is available
- `print_header()`, `print_section()` - Formatted output headers

**Usage**: Sourced by other scripts

```bash
source "$SCRIPT_DIR/utils.sh"
```

**Called by**: post-create.sh, post-start.sh, health-check.sh

---

### `health-check.sh`

**Purpose**: Service health validation and status display

**Functions**:

- `check_postgres_health()` - Validates PostgreSQL database health using pg_isready
- `check_http_health()` - Checks HTTP endpoints with retry logic
- `check_container_running()` - Verifies Docker container status
- `get_container_health()` - Returns container health status
- `wait_for_databases()` - Waits for all 7 PostgreSQL instances
- `wait_for_backend_services()` - Checks all API healthcheck endpoints
- `display_service_status()` - Shows comprehensive service status table
- `verify_database_state()` - Checks if databases exist and have tables
- `display_database_state()` - Shows database state information

**Usage**: Sourced by post-start.sh or called directly

```bash
source .devcontainer/scripts/health-check.sh
wait_for_databases
display_service_status
```

**Called by**: post-start.sh (automatically), manual via `health` alias

**Dependencies**: docker, psql, curl, sources utils.sh

---

### `validate-performance.sh`

**Purpose**: Automated performance testing against specifications

**Tests**:

- **Test 1: Startup Timing** (SC-004) - Services healthy within 2 minutes
- **Test 2: Hot Reload** (SC-005) - Code changes visible within 3 seconds
- **Test 3: Full Mode Memory** (SC-009) - <4GB RAM usage
- **Test 4: Minimal Mode Memory** (SC-009) - <2GB RAM usage

**Usage**:

```bash
# Run all tests
.devcontainer/scripts/validate-performance.sh --all

# Run specific test
.devcontainer/scripts/validate-performance.sh startup
.devcontainer/scripts/validate-performance.sh hot-reload
.devcontainer/scripts/validate-performance.sh full-memory
.devcontainer/scripts/validate-performance.sh minimal-memory
```

**Output**:

- Color-coded results (✓ PASS, ✗ FAIL, ⊘ SKIP)
- Detailed measurements (seconds, MB/GB)
- Summary with pass/fail counts
- Troubleshooting suggestions for failures

**Called by**: Manual execution during validation, CI/CD pipeline (future)

**Dependencies**: docker, docker stats, sources utils.sh and health-check.sh

**When to Run**:

- After making performance-related changes
- Before major releases
- When validating on new hardware
- Troubleshooting performance issues

---

### `validate-setup.sh`

**Purpose**: Pre-flight checks to validate prerequisites before starting dev container

**Checks Performed**:

1. **Docker Installation** - Version ≥20.10 required
2. **Docker Daemon** - Running and accessible
3. **Docker Compose** - Available (standalone or plugin)
4. **Available RAM** - ≥4GB required, ≥8GB recommended
5. **Disk Space** - ≥10GB required, ≥20GB recommended
6. **Git** - Installed and accessible
7. **VS Code** - Present (if running locally)
8. **Dev Containers Extension** - Detected if in container
9. **Node.js** - Version ≥18.x (if in container)
10. **Port Availability** - Checks all 13 required ports

**Usage**:

```bash
# Run validation before creating dev container
.devcontainer/scripts/validate-setup.sh

# Or run from repository root (before opening in container)
bash .devcontainer/scripts/validate-setup.sh
```

**Output**:

- Color-coded results (✓ PASS, ⚠ WARN, ✗ FAIL)
- Detailed information for each check
- Summary with pass/warn/fail counts
- Actionable recommendations for failures
- Exit code 0 (success) or 1 (failures detected)

**When to Run**:

- **Before first container creation** (recommended)
- After Docker Desktop updates
- When troubleshooting container startup issues
- When setting up on new hardware
- After changing Docker resource allocations

**Integration**:
Can be integrated into post-create.sh or run manually before opening dev container.

---

### `post-create.sh`

**Purpose**: One-time setup after container creation

**When it runs**: Once when container is first created (via `devcontainer.json` postCreateCommand)

**What it does**:

1. **Platform Detection** - Detects Codespaces vs Local environment
2. **RAM Detection** - Checks available system memory
3. **Logging Setup** - Creates `.devcontainer/logs/` directory
4. **Prerequisites Check** - Verifies Docker CLI, docker-compose, Node.js, npm
5. **Environment Generation** - Creates `.env.devcontainer` with localhost URLs
6. **Alias Creation** - Creates `.devcontainer/aliases.sh` with shortcuts
7. **Bashrc Integration** - Auto-loads aliases on terminal start

**Generated Files**:

- `.devcontainer/.env.devcontainer` - Environment variables (localhost URLs, seed profile)
- `.devcontainer/aliases.sh` - Shell shortcuts (dps, mlogs, hstart, etc.)
- `.devcontainer/logs/post-create-YYYYMMDD-HHMMSS.log` - Setup log

**Exit Codes**:

- `0` - Success
- `1` - Missing prerequisites
- `2` - Platform detection failed

**Environment Variables**:

- `$CODESPACES` - GitHub Codespaces detection
- `$REMOTE_CONTAINERS` - VS Code Dev Containers detection
- `$SEED_PROFILE` - Database seed profile (default/minimal/custom)

---

### `post-start.sh`

**Purpose**: Setup that runs every time container starts

**When it runs**: Every time container starts (via `devcontainer.json` postStartCommand)

**What it does**:

1. **Display Banner** - Shows "MyAEGEE Development Environment" header
2. **Environment Detection** - Identifies Codespaces vs Local
3. **RAM Check** - Validates available memory
4. **Minimal Mode Prompt** - Interactive prompt if RAM < 6GB
5. **Service Configuration** - Parses ENABLED_SERVICES
6. **Docker Verification** - Checks Docker daemon accessibility
7. **Network Setup** - Creates OMS Docker network if needed
8. **Port Conflict Detection** - Warns about ports already in use
9. **Service Startup** - Starts services via `make start`
10. **Health Checks** - Validates all services are running
11. **URL Display** - Shows access URLs (localhost or Codespaces)
12. **Commands Reference** - Displays common commands

**Exit Codes**:

- `0` - Success, all services started
- `1` - Insufficient RAM (< 4GB) or Docker not accessible
- `2` - Critical service health check failures

**Interactive Features**:

- **Minimal Mode Prompt** (4-6GB RAM):
  ```
  Would you like to use MINIMAL MODE? [y/N]
  (Auto-selecting 'N' in 15 seconds...)
  ```
  - Press `Y` for minimal mode (core + frontend only)
  - Press `N` or wait for full mode (all services)

**Environment Variables**:

- `$ENABLED_SERVICES` - Colon-separated list of services to start
- `$SEED_PROFILE` - Database seed profile
- `$CODESPACES` - GitHub Codespaces detection
- `$CODESPACE_NAME` - Codespace name (for URL generation)
- `$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` - Codespaces domain

**Logs**: Output to terminal (captured by VS Code)

---

## Script Execution Flow

```
Container Created
     │
     ├─> post-create.sh (ONE TIME)
     │    ├─> Platform detection
     │    ├─> Create .env.devcontainer
     │    └─> Create aliases.sh
     │
Container Started/Restarted
     │
     └─> post-start.sh (EVERY TIME)
          ├─> Display banner
          ├─> RAM check & minimal mode prompt
          ├─> Docker verification
          ├─> Start services (make start)
          ├─> Health checks (sources health-check.sh)
          └─> Display URLs & commands
```

## Common Usage Patterns

### Running Scripts Manually

**Post-create script** (re-run setup):

```bash
bash .devcontainer/scripts/post-create.sh
```

**Post-start script** (re-run startup):

```bash
bash .devcontainer/scripts/post-start.sh
```

**Health check only**:

```bash
source .devcontainer/scripts/health-check.sh
display_service_status
```

### Sourcing Utils in Custom Scripts

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

print_header "My Custom Script"
log_info "Starting custom task..."
```

### Checking Service Health

```bash
# Quick health check
source .devcontainer/scripts/health-check.sh
wait_for_databases && log_success "All databases ready"

# Detailed status
display_service_status
```

## Debugging Scripts

### Enable Debug Mode

```bash
# Add to top of any script
set -x  # Print commands as they execute
set -e  # Exit on any error
```

### View Script Logs

```bash
# Post-create logs
ls -lh .devcontainer/logs/
cat .devcontainer/logs/post-create-*.log

# Post-start output (captured by VS Code)
# View in VS Code Output panel
```

### Test Individual Functions

```bash
# Source the script
source .devcontainer/scripts/utils.sh

# Test functions
get_available_ram_gb
command_exists docker
```

## Adding New Scripts

### Template

```bash
#!/bin/bash
# Script Purpose: Brief description
# Called by: Where this script is called from
# Dependencies: List tools/scripts required

set -e  # Exit on error

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

print_header "Script Name"

# Your code here
log_info "Starting task..."
# ... implementation ...
log_success "Task complete!"
```

### Integration

1. **Create script** in `.devcontainer/scripts/`
2. **Make executable**: `chmod +x .devcontainer/scripts/your-script.sh`
3. **Add to devcontainer.json** if needed:
   ```json
   "postCreateCommand": "bash .devcontainer/scripts/your-script.sh"
   ```
4. **Document** in this README

## Troubleshooting Scripts

### Scripts Not Running

**Problem**: Scripts don't execute or permission denied

**Solutions**:

```bash
# Make scripts executable
chmod +x .devcontainer/scripts/*.sh

# Check shebang
head -n 1 .devcontainer/scripts/*.sh  # Should be #!/bin/bash
```

### PATH Issues

**Problem**: Commands not found in scripts

**Solutions**:

```bash
# Use absolute paths
/usr/bin/docker ps

# Or check PATH
echo $PATH

# Or use command_exists() from utils.sh
command_exists docker || log_error "Docker not found"
```

### Sourcing Issues

**Problem**: "cannot source script" or functions not found

**Solutions**:

```bash
# Use absolute path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Check file exists
[ -f "$SCRIPT_DIR/utils.sh" ] || echo "utils.sh not found"
```

## Contributing

When modifying scripts:

1. **Test locally** before committing
2. **Update comments** in the script
3. **Update this README** with changes
4. **Follow conventions**:
   - Use `log_*()` functions for output
   - Source `utils.sh` for common functions
   - Handle errors gracefully
   - Add comments for complex logic

## See Also

- [Dev Container Setup Guide](../../docs/dev-setup-devcontainer.md)
- [Main README](../../README.md)
- [Dev Container Specification](../devcontainer.json)

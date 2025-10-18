# MyAEGEE Development Setup - VS Code Dev Containers

This guide provides comprehensive instructions for setting up the MyAEGEE development environment using VS Code Dev Containers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [First Time Setup](#first-time-setup)
- [Service Access](#service-access)
- [Development Workflow](#development-workflow)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)
- [Differences from Vagrant](#differences-from-vagrant)
- [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

### Required Software

1. **Docker Desktop** (Windows/Mac) or **Docker Engine 20.10+** (Linux)

   - Download: https://www.docker.com/products/docker-desktop/
   - Memory: Allocate at least 4GB RAM to Docker (8GB recommended for full mode)
   - Storage: ~20GB free disk space

2. **Visual Studio Code**

   - Download: https://code.visualstudio.com/
   - Version: Latest stable release

3. **Dev Containers Extension**
   - Install from: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers
   - Or search "Dev Containers" in VS Code Extensions marketplace

### System Requirements

| Component | Minimum                                  | Recommended     |
| --------- | ---------------------------------------- | --------------- |
| RAM       | 4GB available                            | 8GB+ available  |
| CPU       | 2 cores                                  | 4+ cores        |
| Storage   | 20GB free                                | 50GB+ free      |
| OS        | Windows 10+, macOS 10.14+, Ubuntu 20.04+ | Latest versions |

### Verifying Prerequisites

```bash
# Check Docker installation
docker --version
# Should output: Docker version 20.10.0 or higher

# Check Docker is running
docker ps
# Should list running containers (may be empty)

# Check Docker memory allocation (Docker Desktop)
# Settings → Resources → Memory → At least 4GB
```

### Validating Prerequisites (Recommended)

Before opening the dev container, you can run a validation script to check all prerequisites:

```bash
# Run from repository root (before opening in VS Code)
bash .devcontainer/scripts/validate-setup.sh
```

This will check:

- ✓ Docker version ≥20.10
- ✓ Docker daemon running
- ✓ Docker Compose available
- ✓ RAM ≥4GB (8GB recommended)
- ✓ Disk space ≥10GB (20GB recommended)
- ✓ Git installed
- ✓ All required ports available
- ✓ Node.js version (if in container)

**Example output:**

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║         MyAEGEE Dev Container - Prerequisites Check        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

─────────────────────────────────────────────────────────────
Check 1: Docker Installation
─────────────────────────────────────────────────────────────
✓ PASS - Docker 24.0.6 installed (required: ≥20.10)

[... more checks ...]

═══════════════════════════════════════════════════════════
Validation Summary
═══════════════════════════════════════════════════════════
Passed: 10
Warnings: 0
Failed: 0

╔════════════════════════════════════════════╗
║                                            ║
║   ✓ Prerequisites Met!                     ║
║                                            ║
╚════════════════════════════════════════════╝
```

If any checks fail, the script provides specific instructions to fix them.

---

## Quick Start

### 1. Clone the Repository

```bash
# Clone with all submodules
git clone --recursive https://github.com/AEGEE/MyAEGEE.git

# Navigate to the project
cd MyAEGEE

# If you forgot --recursive, initialize submodules:
git submodule update --init --recursive
```

### 2. Open in VS Code

```bash
# Open the project in VS Code
code .
```

### 3. Reopen in Container

When VS Code opens, you should see a notification:

> **"Folder contains a Dev Container configuration file. Reopen folder to develop in a container"**

Click **"Reopen in Container"**.

**Alternatively**, use the Command Palette:

- Press `F1` or `Ctrl+Shift+P` (Windows/Linux) / `Cmd+Shift+P` (Mac)
- Type: `Dev Containers: Reopen in Container`
- Press Enter

### 4. Wait for Setup

**First-time setup takes 10-15 minutes**:

- Building the dev container image (~5 minutes)
- Installing dependencies (~2 minutes)
- Starting all services (~5 minutes)
- Running health checks (~1 minute)

You can monitor progress in:

- **Terminal output** (opens automatically)
- **Notification area** (bottom-right corner)

**Subsequent startups take ~2 minutes** (services start faster, no rebuild needed)

### 5. Verify Services

When setup completes, you should see:

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║              🌍  MyAEGEE Development Environment  🌍                  ║
║                                                                       ║
║           AEGEE-Europe Online Membership System (OMS)                ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

✓ All systems operational. Happy coding! 🚀
```

Open your browser to **http://localhost:3000** to access the application.

---

## First Time Setup

### Understanding the Setup Process

The dev container setup performs these steps automatically:

1. **Container Build** (`.devcontainer/Dockerfile`)

   - Ubuntu 22.04 base image
   - Node.js 18.x LTS installation
   - Docker CLI and docker-compose
   - PostgreSQL client tools
   - Development utilities (git, vim, jq, etc.)

2. **Post-Create Script** (`.devcontainer/scripts/post-create.sh`)

   - Platform detection (Codespaces vs Local)
   - RAM availability check
   - Environment file generation (`.env.devcontainer`)
   - Shell alias setup (`.devcontainer/aliases.sh`)
   - Bash integration

3. **Post-Start Script** (`.devcontainer/scripts/post-start.sh`)
   - Docker daemon verification
   - OMS network creation
   - Port conflict detection
   - Service startup via `make start`
   - Health check validation
   - Service URL display

### Generated Files

These files are auto-generated (do not commit them):

- `.devcontainer/.env.devcontainer` - Environment variables with localhost URLs
- `.devcontainer/aliases.sh` - Shell shortcuts for common commands
- `.devcontainer/logs/` - Setup and startup logs

### Default Credentials

Test users (password: `5ecr3t5ecr3t` for all):

- `admin@example.com` - System administrator
- `board@example.com` - Board member
- `member@example.com` - Regular member
- `not-confirmed@example.com` - Unconfirmed member
- `password-reset@example.com` - Password reset test user
- `suspended@example.com` - Suspended member

**Admin Panel Credentials**:

- **Portainer**: Create account on first login
- **pgAdmin**:
  - Email: `admin@admin.com`
  - Password: `5ecr3t`
  - Add servers manually (see [Database Access](#database-access))

---

## Service Access

### Main Application

| Service      | URL                   | Description              |
| ------------ | --------------------- | ------------------------ |
| **Frontend** | http://localhost:3000 | Main MyAEGEE application |

### Admin Tools

| Service               | URL                   | Description                      | Credentials              |
| --------------------- | --------------------- | -------------------------------- | ------------------------ |
| **Traefik Dashboard** | http://localhost:8080 | Service routing & load balancing | None required            |
| **Portainer**         | http://localhost:9000 | Docker container management      | Create on first login    |
| **pgAdmin**           | http://localhost:5050 | PostgreSQL database admin        | admin@admin.com / 5ecr3t |

### Backend APIs

All APIs accessible at `http://localhost:PORT`:

| API               | Port | Health Check                      |
| ----------------- | ---- | --------------------------------- |
| Core              | 8084 | http://localhost:8084/healthcheck |
| Events            | 8085 | http://localhost:8085/healthcheck |
| Statutory         | 8086 | http://localhost:8086/healthcheck |
| Discounts         | 8087 | http://localhost:8087/healthcheck |
| Knowledge         | 8088 | http://localhost:8088/healthcheck |
| Summer University | 8089 | http://localhost:8089/healthcheck |
| Network           | 8090 | http://localhost:8090/healthcheck |
| Mailer            | 8091 | http://localhost:8091/healthcheck |
| GSuite Wrapper    | 8092 | http://localhost:8092/healthcheck |

### Database Access

Each microservice has its own PostgreSQL database:

| Database          | Container Name                      | Port (internal) |
| ----------------- | ----------------------------------- | --------------- |
| Core              | myaegee_postgres-core_1             | 5432            |
| Events            | myaegee_postgres-events_1           | 5432            |
| Statutory         | myaegee_postgres-statutory_1        | 5432            |
| Discounts         | myaegee_postgres-discounts_1        | 5432            |
| Knowledge         | myaegee_postgres-knowledge_1        | 5432            |
| Summer University | myaegee_postgres-summeruniversity_1 | 5432            |
| Network           | myaegee_postgres-network_1          | 5432            |

**Connecting via pgAdmin**:

1. Open http://localhost:5050
2. Login with admin@admin.com / 5ecr3t
3. Right-click "Servers" → "Create" → "Server"
4. General tab: Name = "Core Database" (or any name)
5. Connection tab:
   - Host: `myaegee_postgres-core_1` (or other database container name)
   - Port: `5432`
   - Username: `postgres`
   - Password: (check `.env` file or `current-config.yml`)

**Connecting via command line**:

```bash
# List all database containers
docker ps | grep postgres

# Connect to Core database
docker exec -it myaegee_postgres-core_1 psql -U postgres -d oms-core-db

# Common psql commands:
\l          # List databases
\dt         # List tables
\q          # Quit
```

---

## Development Workflow

### Editing Code

1. **Files are automatically synced** between your host machine and the container
2. **Changes trigger hot-reload** for most services (no restart needed)
3. **Use your favorite VS Code extensions** (they work inside the container)

### Running Tests

```bash
# Navigate to a service directory
cdcore              # or: cd core/

# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Making Database Changes

```bash
# Create a new migration (example: Core service)
cdcore
npm run db:create-migration -- add-new-field

# Run migrations
npm run db:migrate

# Seed data
npm run db:seed

# Reset database (caution: deletes all data!)
make reset-db       # Resets ALL databases
```

### Database Management

#### Database Persistence

All database data is stored in **Docker named volumes** that persist across container restarts:

**Volume names**:

- `myaegee_postgres-core-db` - Core service database
- `myaegee_postgres-events-db` - Events service database
- `myaegee_postgres-statutory-db` - Statutory service database
- `myaegee_postgres-discounts-db` - Discounts service database
- `myaegee_postgres-knowledge-db` - Knowledge service database
- `myaegee_postgres-summeruniversity-db` - Summer University database
- `myaegee_postgres-network-db` - Network service database

**Volume locations**:

- Linux: `/var/lib/docker/volumes/`
- Mac: `~/Library/Containers/com.docker.docker/Data/vms/0/`
- Windows: `\\wsl$\docker-desktop-data\data\docker\volumes\`

#### Resetting Databases

**Reset all databases** (destructive - deletes all data):

```bash
make reset-db
# Confirmation prompt with 5-second delay
# Stops services, removes volumes, restarts with seed data
```

**Reset specific database**:

```bash
make reset-db-core            # Reset Core database only
make reset-db-events          # Reset Events database only
make reset-db-statutory       # Reset Statutory database only
make reset-db-discounts       # Reset Discounts database only
make reset-db-network         # Reset Network database only
make reset-db-summeruniversity  # Reset Summer University database
make reset-db-knowledge       # Reset Knowledge database only
```

**Reset with minimal seed profile**:

```bash
make reset-db-minimal
# Uses SEED_PROFILE=minimal (essential data only)
```

#### Seed Profiles

Control how much data is seeded into databases:

**Available profiles**:

- `default` (default): Full seed data with test users and sample content
- `minimal`: Essential data only (admin user and basic structure)
- `custom`: Define your own seed data

**Setting seed profile**:

```bash
# Edit .devcontainer/.env.devcontainer
SEED_PROFILE=minimal

# Or set before reset
SEED_PROFILE=minimal make reset-db
```

**Default seed data includes**:

- Test users (admin@example.com, member@example.com, etc.)
- Sample antennas and bodies
- Demo events and applications
- Test statutory data

**Minimal seed data includes**:

- Admin user only
- Required system configuration
- No sample content

#### Database Verification

**Check database state**:

```bash
# Run health check (includes database state)
health

# Check if databases exist with tables
docker exec myaegee_postgres-core_1 psql -U postgres -d oms-core-db -c "\dt"

# Count tables in database
docker exec myaegee_postgres-core_1 psql -U postgres -d oms-core-db -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

**List all volumes**:

```bash
docker volume ls | grep myaegee
```

**Inspect volume**:

```bash
docker volume inspect myaegee_postgres-core-db
```

#### Backing Up Databases

**Backup all databases**:

```bash
make backup
# Creates dumps in current directory with timestamps
```

**Backup specific database**:

```bash
make backup_core       # Backup Core database
make backup_events     # Backup Events database
make backup_statutory  # Backup Statutory database
```

**Manual backup**:

```bash
# Backup Core database
docker exec myaegee_postgres-core_1 pg_dump -U postgres oms-core-db > core-backup-$(date +%Y%m%d).sql

# Backup with compression
docker exec myaegee_postgres-core_1 pg_dump -U postgres oms-core-db | gzip > core-backup-$(date +%Y%m%d).sql.gz
```

#### Restoring Databases

**From backup file**:

```bash
# Stop service first
make stop

# Restore Core database
cat core-backup-20241018.sql | docker exec -i myaegee_postgres-core_1 psql -U postgres -d oms-core-db

# Or with compressed backup
gunzip < core-backup-20241018.sql.gz | docker exec -i myaegee_postgres-core_1 psql -U postgres -d oms-core-db

# Start service
make start
```

#### Database Troubleshooting

**Problem**: "Connection refused" to database

**Solutions**:

1. Check database container is running:

   ```bash
   docker ps | grep postgres
   ```

2. Check database logs:

   ```bash
   docker logs myaegee_postgres-core_1
   ```

3. Verify database is ready:
   ```bash
   docker exec myaegee_postgres-core_1 pg_isready -U postgres
   ```

**Problem**: "Database does not exist"

**Solutions**:

1. Run migrations:

   ```bash
   cdcore
   npm run db:migrate
   ```

2. Reset database:
   ```bash
   make reset-db-core
   ```

**Problem**: "No tables in database"

**Solutions**:

1. Migrations haven't run - run them:
   ```bash
   cdcore
   npm run db:migrate
   npm run db:seed
   ```

**Problem**: Database corruption

**Solutions**:

1. **Nuclear option** - delete volume and recreate:

   ```bash
   make stop
   docker volume rm myaegee_postgres-core-db
   make start
   ```

2. **From backup**:
   ```bash
   # Restore from backup (see above)
   ```

#### Volume Management

**List volumes**:

```bash
docker volume ls
```

**Remove all MyAEGEE volumes** (destructive):

```bash
docker volume rm $(docker volume ls -q | grep myaegee)
```

**Check volume size**:

```bash
docker system df -v | grep myaegee
```

**Clean up unused volumes**:

```bash
docker volume prune
```

### Viewing Logs

```bash
# Using shell aliases (recommended)
mlogs               # View all service logs
dlogs core          # View logs for specific service
hlogs core events   # View logs for multiple services

# Using make commands
make monitor        # Interactive log viewer
make logs           # Dump all logs

# Using docker directly
docker logs myaegee_core_1 -f         # Follow logs
docker logs myaegee_events_1 --tail=100  # Last 100 lines
```

### Service Management

```bash
# Start all services
make start          # or: mstart

# Stop all services
make stop           # or: mstop

# Restart all services
make restart        # or: mrestart

# Restart specific service
docker restart myaegee_core_1

# Check service health
health              # Run health check script

# List running services
make list           # or: dps
```

### Installing Dependencies

```bash
# Navigate to service directory
cdcore

# Install npm package
npm install lodash

# Update package
npm update express

# Install globally (in container)
npm install -g some-tool
```

### Git Workflow

```bash
# All git commands work normally
git status
git add .
git commit -m "Your message"
git push

# Submodule updates
git submodule update --remote
make bump           # Updates all submodules
```

---

## Common Commands

### Shell Aliases

Pre-configured shortcuts (type `alias` to see all):

#### Service Management (Make)

```bash
mstart              # make start
mstop               # make stop
mrestart            # make restart
mlogs               # make monitor
```

#### Service Management (Helper Script)

```bash
hstart              # ./helper.sh --start
hstop               # ./helper.sh --stop
hlogs [services]    # ./helper.sh --monitor [services]
hexec <svc> <cmd>   # ./helper.sh --execute <service> <command>
```

#### Docker Shortcuts

```bash
dps                 # docker ps (formatted table)
dlogs <service>     # docker logs <service> -f
dstop <service>     # docker stop <service>
drestart <service>  # docker restart <service>
```

#### Navigation

```bash
cdcore              # cd /workspace/core
cdevents            # cd /workspace/events
cdstatutory         # cd /workspace/statutory
cdfrontend          # cd /workspace/frontend
```

#### Utilities

```bash
health              # Run health check script
```

### Make Commands

```bash
make help           # Show all available commands
make start          # Start all services
make stop           # Stop all services
make restart        # Restart all services
make monitor        # View service logs interactively
make list           # List running containers
make reset-db       # Reset databases (destructive!)
make bump           # Update all submodules
make init           # Initialize system (first-time only)
make build          # Build/rebuild containers
```

### Helper Script Commands

```bash
# Start specific services
./helper.sh --start core events frontend

# Monitor specific services
./helper.sh --monitor core events

# Execute command in service container
./helper.sh --execute core npm test

# List all services
./helper.sh --list
```

---

## Troubleshooting

### Container Won't Start

**Problem**: "Failed to connect to Docker daemon"

**Solutions**:

1. Ensure Docker Desktop is running
2. Check Docker status: `docker ps`
3. Restart Docker Desktop
4. Linux: `sudo systemctl start docker`

---

**Problem**: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock"

**Solutions**:

1. Docker socket not mounted properly
2. Check `.devcontainer/docker-compose.devcontainer.yml`:
   ```yaml
   volumes:
     - /var/run/docker.sock:/var/run/docker.sock
   ```
3. Rebuild container: Command Palette → "Dev Containers: Rebuild Container"

---

### Port Already in Use

**Problem**: "Port 3000 is already in use"

**Solutions**:

1. **Find conflicting process**:

   ```bash
   # Linux/Mac
   lsof -i :3000

   # Windows (PowerShell)
   netstat -ano | findstr :3000
   ```

2. **Stop conflicting process**:

   ```bash
   # Kill process by PID
   kill <PID>              # Linux/Mac
   taskkill /PID <PID> /F  # Windows
   ```

3. **Change port in devcontainer.json**:
   ```json
   "forwardPorts": [
     "3001:3000",  // Changed from 3000:3000
     ...
   ]
   ```

---

### Services Won't Start

**Problem**: Services stuck at "Starting..." or health checks fail

**Solutions**:

1. **Check service logs**:

   ```bash
   dlogs core
   dlogs postgres-core
   ```

2. **Verify database is healthy**:

   ```bash
   docker exec myaegee_postgres-core_1 pg_isready -U postgres
   ```

3. **Restart specific service**:

   ```bash
   docker restart myaegee_core_1
   ```

4. **Reset everything** (nuclear option):
   ```bash
   make stop
   docker system prune -af
   make start
   ```

---

### Hot Reload Not Working

**Problem**: Code changes don't trigger rebuild

**Solutions**:

1. **Check workspace mount** in `docker-compose.devcontainer.yml`:

   ```yaml
   volumes:
     - ..:/workspace:cached # :cached enables hot-reload
   ```

2. **Restart service**:

   ```bash
   docker restart myaegee_core_1
   ```

3. **Check service's hot-reload config** (e.g., nodemon):
   ```bash
   cdcore
   cat package.json  # Look for "dev" script with nodemon
   ```

---

### Database Connection Errors

**Problem**: "Connection refused" or "Cannot connect to database"

**Solutions**:

1. **Check database is running**:

   ```bash
   docker ps | grep postgres
   ```

2. **Check database logs**:

   ```bash
   docker logs myaegee_postgres-core_1
   ```

3. **Verify credentials** in `.env`:

   ```bash
   cat .env | grep DB_PASSWORD
   ```

4. **Reset database**:
   ```bash
   make reset-db       # Caution: deletes all data!
   ```

---

### Out of Memory Errors

**Problem**: "Cannot allocate memory" or services crashing

**Solutions**:

1. **Increase Docker memory**:
   - Docker Desktop: Settings → Resources → Memory → 8GB+
2. **Use minimal mode** (fewer services):

   ```bash
   # Edit .env file
   ENABLED_SERVICES=core:frontend:events

   # Restart
   make restart
   ```

3. **Check available RAM**:
   ```bash
   free -g              # Linux
   vm_stat | grep free  # Mac
   ```

---

### Permission Errors

**Problem**: "Permission denied" when running commands

**Solutions**:

1. **Check file ownership**:

   ```bash
   ls -la /workspace
   ```

2. **Fix permissions**:

   ```bash
   sudo chown -R vscode:vscode /workspace
   ```

3. **Run as vscode user** (should be automatic):
   ```bash
   whoami  # Should output: vscode
   ```

---

### Submodule Issues

**Problem**: "fatal: not a git repository" or missing service folders

**Solutions**:

1. **Initialize submodules**:

   ```bash
   git submodule update --init --recursive
   ```

2. **Update submodules**:

   ```bash
   git submodule update --remote
   make bump  # Alternative
   ```

3. **Reset submodules**:
   ```bash
   git submodule deinit -f --all
   rm -rf .git/modules
   git submodule update --init --recursive
   ```

---

### Extension Not Loading

**Problem**: VS Code extensions not available in container

**Solutions**:

1. **Extensions should auto-install** (defined in `devcontainer.json`)

2. **Manual installation**:

   - Open Extensions panel (`Ctrl+Shift+X`)
   - Search for extension
   - Click "Install in Dev Container"

3. **Add to devcontainer.json**:

   ```json
   "customizations": {
     "vscode": {
       "extensions": [
         "dbaeumer.vscode-eslint",
         "your.extension.id"
       ]
     }
   }
   ```

4. **Rebuild container**: Command Palette → "Dev Containers: Rebuild Container"

---

## Differences from Vagrant

### Architecture

| Aspect             | Vagrant              | Dev Containers    |
| ------------------ | -------------------- | ----------------- |
| **Virtualization** | Full VM (VirtualBox) | Docker containers |
| **Memory Usage**   | 8GB+                 | 4GB+              |
| **Startup Time**   | 15-25 minutes        | 2-15 minutes      |
| **Disk Usage**     | 30GB+                | 20GB+             |
| **Network**        | Bridged/NAT          | Host networking   |

### URLs

| Environment        | Frontend                 | APIs                              | Admin Tools                       |
| ------------------ | ------------------------ | --------------------------------- | --------------------------------- |
| **Vagrant**        | http://my.appserver.test | http://\<service\>.appserver.test | http://\<tool\>.appserver.test    |
| **Dev Containers** | http://localhost:3000    | http://localhost:8084-8092        | http://localhost:8080, 9000, 5050 |

### Configuration

| Aspect            | Vagrant                           | Dev Containers                       |
| ----------------- | --------------------------------- | ------------------------------------ |
| **Hosts file**    | Must edit `/etc/hosts`            | No editing needed                    |
| **Environment**   | `.env` file                       | `.env.devcontainer` (auto-generated) |
| **Service start** | `vagrant up` + `make start`       | Automatic on container start         |
| **IDE**           | Any (files synced via VirtualBox) | VS Code (integrated)                 |

### Commands

| Task      | Vagrant                                     | Dev Containers                       |
| --------- | ------------------------------------------- | ------------------------------------ |
| **Start** | `vagrant up` → `vagrant ssh` → `make start` | Auto-starts on container open        |
| **Stop**  | `vagrant halt`                              | Close VS Code / stop container       |
| **Reset** | `vagrant destroy` + `vagrant up`            | `make reset-db` or rebuild container |
| **SSH**   | `vagrant ssh`                               | Already inside container (terminal)  |
| **Logs**  | `vagrant ssh` → `make logs`                 | `mlogs` or `make logs`               |

### Advantages of Dev Containers

✅ **Faster startup** (no VM boot time)  
✅ **Lower resource usage** (no VM overhead)  
✅ **Better integration** (VS Code extensions, debugging)  
✅ **Simpler networking** (localhost instead of custom domains)  
✅ **No hosts file editing**  
✅ **Cross-platform consistency** (same container on Windows/Mac/Linux)  
✅ **GitHub Codespaces ready** (same config works in cloud)

### Advantages of Vagrant

✅ **Isolated VM** (more separation from host)  
✅ **Proven solution** (years of production use)  
✅ **Custom domains** (\*.appserver.test)  
✅ **Works without VS Code**  
✅ **Full production parity** (if server uses VMs)

---

## Advanced Configuration

### Customizing Services

Edit `.env` file to enable/disable services:

```bash
# Enable only specific services
ENABLED_SERVICES=core:frontend:events:statutory

# Enable all services (default)
ENABLED_SERVICES=core:frontend:events:statutory:discounts:knowledge:summeruniversity:network:mailer:gsuite-wrapper:gateways:dev-tools

# Restart to apply changes
make restart
```

### Minimal Mode

**Minimal mode** reduces resource usage by running only essential services.

#### What is Minimal Mode?

Minimal mode starts only:

- ✅ **Core API** - User management, authentication
- ✅ **Frontend** - Vue.js application
- ✅ **Required databases** - PostgreSQL for core

All other services are disabled to save memory and improve performance.

#### When to Use Minimal Mode

**Automatically suggested when**:

- Available RAM: 4-6GB
- Dev container startup detects limited resources
- Interactive prompt appears with 15-second timeout

**Manually enable when**:

- Working on frontend-only changes
- Debugging core functionality
- Running on low-spec machines
- Multiple dev containers simultaneously

#### How to Enable Minimal Mode

**Option 1: Interactive Prompt (Automatic)**

When starting dev container with 4-6GB RAM:

```
Would you like to use MINIMAL MODE? [y/N]
(Auto-selecting 'N' in 15 seconds...)
```

Press `Y` to enable minimal mode.

**Option 2: Edit .env File (Manual)**

```bash
# Edit .env file
nano .env

# Set ENABLED_SERVICES
ENABLED_SERVICES=core:frontend

# Save and restart
make restart
```

**Option 3: Environment Variable (Temporary)**

```bash
# Set for current session
export ENABLED_SERVICES=core:frontend

# Restart services
make restart
```

#### Switching Between Modes

**From Minimal to Full Mode**:

```bash
# Edit .env file
nano .env

# Change to full mode
ENABLED_SERVICES=gateways:frontend:core:statutory:events:network:summeruniversity:discounts:knowledge:mailer:gsuite-wrapper

# Or comment out to use default
#ENABLED_SERVICES=...

# Restart
make restart
```

**From Full to Minimal Mode**:

```bash
# Edit .env file
nano .env

# Set minimal mode
ENABLED_SERVICES=core:frontend

# Restart
make restart
```

**Quick toggle** (dev containers):

```bash
# Minimal mode
echo "ENABLED_SERVICES=core:frontend" > .devcontainer/.env.devcontainer
make restart

# Full mode
rm .devcontainer/.env.devcontainer
make restart
```

#### Custom Service Combinations

You can enable any combination of services:

**Frontend + Core + Events**:

```bash
ENABLED_SERVICES=core:frontend:events
```

**Backend APIs only** (for API testing):

```bash
ENABLED_SERVICES=core:events:statutory:discounts
```

**Full backend, no dev tools**:

```bash
ENABLED_SERVICES=frontend:core:events:statutory:discounts:knowledge:summeruniversity:network:mailer:gsuite-wrapper
```

#### Available Services

| Service            | Purpose                | Required?   | RAM Impact |
| ------------------ | ---------------------- | ----------- | ---------- |
| `core`             | User management, auth  | ✅ Required | ~400MB     |
| `frontend`         | Vue.js application     | ✅ Required | ~200MB     |
| `events`           | Events management      | Optional    | ~300MB     |
| `statutory`        | Statutory events       | Optional    | ~300MB     |
| `discounts`        | Discount codes         | Optional    | ~250MB     |
| `knowledge`        | Knowledge base         | Optional    | ~250MB     |
| `summeruniversity` | Summer University      | Optional    | ~300MB     |
| `network`          | Network bodies         | Optional    | ~250MB     |
| `mailer`           | Email service (Elixir) | Optional    | ~400MB     |
| `gsuite-wrapper`   | Google integration     | Optional    | ~200MB     |
| `gateways`         | Traefik proxy          | Optional    | ~100MB     |
| `dev-tools`        | Portainer, pgAdmin     | Optional    | ~300MB     |

**Total**:

- Minimal mode: ~600MB (core + frontend)
- Full mode: ~3.5GB (all services)

#### Performance Comparison

| Metric                        | Minimal Mode    | Full Mode      |
| ----------------------------- | --------------- | -------------- |
| **Startup Time**              | ~1 minute       | ~2 minutes     |
| **Memory Usage**              | ~2GB            | ~4GB           |
| **CPU Usage**                 | ~20%            | ~40%           |
| **Services Running**          | 2 APIs + 1 DB   | 9 APIs + 7 DBs |
| **Available for Development** | Core + Frontend | All features   |

#### Troubleshooting Minimal Mode

**Problem**: Service not accessible (404 or connection refused)

**Solution**: Service is disabled in minimal mode. Enable it:

```bash
# Check current services
cat .env | grep ENABLED_SERVICES

# Add the service you need
ENABLED_SERVICES=core:frontend:events

# Restart
make restart
```

**Problem**: Minimal mode not suggested despite low RAM

**Solution**: RAM detection may be inaccurate:

```bash
# Check detected RAM
free -g  # Linux
vm_stat | grep free  # Mac

# Manually enable minimal mode
ENABLED_SERVICES=core:frontend make restart
```

**Problem**: Want to permanently set minimal mode

**Solution**: Add to .env file (persists across restarts):

```bash
echo "ENABLED_SERVICES=core:frontend" >> .env
```

**Problem**: Services start even though not in ENABLED_SERVICES

**Solution**: Some services may be started by helper.sh based on .env:

```bash
# Ensure .env has correct ENABLED_SERVICES
cat .env | grep ENABLED_SERVICES

# Force stop unwanted services
docker stop myaegee_events_1 myaegee_statutory_1
```

### Changing Port Mappings

Edit `.devcontainer/devcontainer.json`:

```json
"forwardPorts": [
  "3000:3000",      // Frontend
  "8080:8080",      // Traefik
  "8084:8084",      // Core API
  // Add or modify ports as needed
]
```

Rebuild container after changes:

- Command Palette → "Dev Containers: Rebuild Container"

### Adding VS Code Extensions

Edit `.devcontainer/devcontainer.json`:

```json
"customizations": {
  "vscode": {
    "extensions": [
      "dbaeumer.vscode-eslint",
      "editorconfig.editorconfig",
      // Add your extensions here
      "your.extension.id"
    ]
  }
}
```

### Customizing Startup Scripts

**Post-Create Script** (`.devcontainer/scripts/post-create.sh`)

- Runs once when container is created
- Use for: Installing global tools, configuring shell, one-time setup

**Post-Start Script** (`.devcontainer/scripts/post-start.sh`)

- Runs every time container starts
- Use for: Starting services, health checks, displaying status

Example: Add custom banner to post-start.sh:

```bash
# Add to .devcontainer/scripts/post-start.sh
echo "🎉 Welcome $(whoami)! Happy coding!"
```

### Using GitHub Codespaces

The same dev container configuration works in GitHub Codespaces!

1. Go to GitHub repository
2. Click **Code** → **Codespaces** → **Create codespace on main**
3. Wait for container to build (~10 minutes first time)
4. Access services via forwarded ports (URLs shown in PORTS tab)

**Codespaces URLs are different**:

- Format: `https://<codespace-name>-<port>.app.github.dev`
- Check PORTS tab in VS Code for exact URLs
- Example: `https://friendly-space-disco-123abc-3000.app.github.dev`

### Codespaces-Specific Troubleshooting

#### Port Forwarding Issues

**Problem**: Cannot access service URLs

**Solutions**:

1. **Check PORTS tab**:

   - Open VS Code bottom panel
   - Click "PORTS" tab (next to Terminal)
   - Verify ports are listed and forwarded

2. **Port visibility**:

   - Right-click port in PORTS tab
   - Select "Port Visibility" → "Public"
   - Some ports may default to "Private" (require GitHub authentication)

3. **Refresh forwarded URL**:

   - Click globe icon (🌐) next to port
   - Copy the forwarded URL
   - Try in incognito/private browser window

4. **Check service is running**:
   ```bash
   dps  # List running containers
   health  # Check service health
   ```

---

#### Codespace Build Failures

**Problem**: "Failed to create codespace" or build errors

**Solutions**:

1. **Check Dockerfile syntax**:

   - Verify `.devcontainer/Dockerfile` has no syntax errors
   - Check all RUN commands complete successfully

2. **Increase build timeout**:

   - GitHub times out builds after 45 minutes
   - Optimize Dockerfile to use caching

3. **Check prebuild status**:

   - Go to repository → Actions tab
   - Check if "Codespaces Prebuild" workflow succeeded
   - Failed prebuilds cause slower manual builds

4. **Try manual build**:
   - Delete failed Codespace
   - Create new Codespace
   - Wait patiently (first build is slow)

---

#### Quota Exceeded

**Problem**: "You've reached your Codespaces usage limit"

**Solutions**:

1. **Check quota usage**:

   - GitHub → Settings → Billing → Codespaces
   - View core-hours used this month

2. **Stop unused Codespaces**:

   - GitHub → Code → Codespaces
   - Stop or delete Codespaces you're not using

3. **Reduce machine size**:

   - When creating Codespace, choose 2-core machine
   - Default 4-core uses quota twice as fast

4. **Upgrade plan**:
   - Free: 120 core-hours/month
   - Pro: 180 core-hours/month
   - Team/Enterprise: Custom quotas

---

#### Slow Performance

**Problem**: Codespace is laggy or services are slow

**Solutions**:

1. **Upgrade machine type**:

   - Code → Codespaces → Change machine type
   - Choose 4-core or 8-core machine
   - Restart Codespace

2. **Check resource usage**:

   ```bash
   docker stats  # View container resource usage
   top           # View system processes
   ```

3. **Use minimal mode**:

   - Edit `.env` to reduce services:
     ```bash
     ENABLED_SERVICES=core:frontend
     ```
   - Restart services: `make restart`

4. **Check region**:
   - Codespaces in different regions have different performance
   - Recreate Codespace in a different region

---

#### Services Not Starting

**Problem**: Services fail to start in Codespace

**Solutions**:

1. **Check Docker socket**:

   ```bash
   docker ps  # Should not error
   ls -la /var/run/docker.sock  # Should exist
   ```

2. **Increase memory**:

   - Codespaces default to 2-core with 4GB RAM
   - Upgrade to 4-core (8GB RAM) or 8-core (16GB RAM)

3. **Check logs**:

   ```bash
   # Check post-start script logs
   cat ~/.config/Code/logs/*/exthost*/output_logging_*

   # Check service logs
   mlogs
   ```

4. **Manual service start**:
   ```bash
   cd /workspace
   make start
   ```

---

#### Port Forwarding URL Changes

**Problem**: Bookmarked URLs stop working

**Solutions**:

1. **URLs change with each Codespace**:

   - Each Codespace has unique name
   - URLs include codespace name
   - Use PORTS tab to find current URLs

2. **Use relative links in development**:

   - Within the app, use relative URLs (`/api/...`)
   - Don't hardcode full URLs

3. **Check port visibility**:
   - Private ports: Require GitHub auth
   - Public ports: Accessible to anyone with URL
   - Set in `.devcontainer/devcontainer.json`

---

#### Persistent Data Issues

**Problem**: Data lost when Codespace stops

**Solutions**:

1. **Volumes should persist**:

   - Database volumes persist across stops/starts
   - Only full deletion removes data

2. **Verify volumes**:

   ```bash
   docker volume ls  # List volumes
   docker volume inspect myaegee-core-db  # Check volume
   ```

3. **If data lost**:

   - May need to run migrations again:
     ```bash
     cdcore
     npm run db:migrate
     npm run db:seed
     ```

4. **Export important data**:
   - Don't rely on Codespaces for long-term storage
   - Export databases periodically:
     ```bash
     make dump  # If available
     ```

---

#### Codespace Connection Issues

**Problem**: "Cannot connect to Codespace" or frequent disconnects

**Solutions**:

1. **Check internet connection**:

   - Codespaces require stable internet
   - Try different network if possible

2. **Restart Codespace**:

   - GitHub → Code → Codespaces → Restart

3. **Reconnect VS Code**:

   - Command Palette: "Codespaces: Reconnect"

4. **Browser vs VS Code Desktop**:
   - Try browser editor: `https://github.dev/...`
   - Or desktop VS Code: Install "GitHub Codespaces" extension

---

#### Prebuild Not Working

**Problem**: Codespaces still take 10-15 minutes despite prebuild

**Solutions**:

1. **Check prebuild workflow**:

   - Repository → Actions tab
   - "Codespaces Prebuild" should show successful runs
   - Failed prebuilds won't be used

2. **Verify prebuild is used**:

   - When creating Codespace, should see "Using prebuild"
   - If not, prebuild may not match your branch

3. **Prebuild only for main branches**:

   - Workflow configured for `main`, `develop`, `001-devcontainer-migration`
   - Other branches build from scratch

4. **Clear cache and rebuild**:
   - Workflows may need cache invalidation
   - Edit `.devcontainer/Dockerfile` (add comment)
   - Push to trigger new prebuild

---

## Getting Help

### Documentation Resources

- **Main README**: [../README.md](../README.md)
- **Dev Container Spec**: [../.devcontainer/devcontainer.json](../.devcontainer/devcontainer.json)
- **Service Docs**: Each service has its own README in `<service>/README.md`
- **Wiki**: https://myaegee.atlassian.net/wiki/spaces/GENERAL/overview

### Community Support

- **Issue Tracker**: https://myaegee.atlassian.net/projects/MEMB/issues
- **Confluence**: https://myaegee.atlassian.net/wiki/spaces/GENERAL/overview
- **GitHub Discussions**: https://github.com/AEGEE/MyAEGEE/discussions

### Debugging Tips

1. **Check terminal output** - Most errors are logged there
2. **Review logs** - `mlogs` or `dlogs <service>`
3. **Verify Docker** - `docker ps`, `docker stats`
4. **Check resources** - RAM, disk space, CPU usage
5. **Rebuild container** - Command Palette → "Dev Containers: Rebuild Container"
6. **Nuclear reset** - Delete container volumes, rebuild from scratch

---

## Performance Validation

The dev container includes automated performance tests to validate against specifications:

### Running Performance Tests

```bash
# Run all performance tests
.devcontainer/scripts/validate-performance.sh --all

# Run specific test
.devcontainer/scripts/validate-performance.sh startup       # Test startup time
.devcontainer/scripts/validate-performance.sh hot-reload    # Test hot reload
.devcontainer/scripts/validate-performance.sh full-memory   # Test full mode memory
.devcontainer/scripts/validate-performance.sh minimal-memory # Test minimal mode memory
```

### Performance Specifications

| Test                    | Specification | Target                      | How It's Tested                                            |
| ----------------------- | ------------- | --------------------------- | ---------------------------------------------------------- |
| **Startup Time**        | SC-004        | Services healthy <2 minutes | Measures time from `make start` to all services healthy    |
| **Hot Reload**          | SC-005        | Changes visible <3 seconds  | Modifies file and detects rebuild in logs                  |
| **Full Mode Memory**    | SC-009        | <4GB RAM usage              | Measures total memory via `docker stats` with all services |
| **Minimal Mode Memory** | SC-009        | <2GB RAM usage              | Measures memory with core+frontend only                    |

### Test Output

The validation script provides:

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║         MyAEGEE Dev Container Performance Tests            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════
Test 1: Startup Timing (SC-004: <2 minutes)
═══════════════════════════════════════════════════════════
Startup time: 98s (98 seconds)
✓ PASS - Startup timing: 98s ≤ 120s target

═══════════════════════════════════════════════════════════
Test 2: Hot Reload (SC-005: <3 seconds)
═══════════════════════════════════════════════════════════
Hot reload detection time: 2s
✓ PASS - Hot reload: 2s ≤ 3s target

═══════════════════════════════════════════════════════════
Test Summary
═══════════════════════════════════════════════════════════
Total tests: 4
Passed: 4
Failed: 0
Skipped: 0

╔════════════════════════════════════════╗
║                                        ║
║   ✓ ALL TESTS PASSED!                  ║
║                                        ║
╚════════════════════════════════════════╝
```

### When to Run Performance Tests

**Recommended times**:

- After making performance-related changes
- Before major releases or pull requests
- When validating setup on new hardware
- Troubleshooting performance issues
- Verifying Docker resource allocation changes

### Improving Performance

If tests fail, try:

**For Startup Timing**:

```bash
# Use minimal mode
ENABLED_SERVICES=core:frontend make restart

# Increase Docker CPU allocation
# Docker Desktop → Settings → Resources → CPUs: 4+

# Use SSD for Docker storage
# Docker Desktop → Settings → Resources → Disk image location
```

**For Memory Usage**:

```bash
# Use minimal mode (saves ~2GB)
ENABLED_SERVICES=core:frontend make restart

# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory: 8GB+

# Close memory-intensive applications
# Chrome tabs, other IDEs, etc.
```

**For Hot Reload**:

```bash
# Check file watcher limits (Linux)
cat /proc/sys/fs/inotify/max_user_watches
sudo sysctl fs.inotify.max_user_watches=524288

# Verify volume mount is cached
cat .devcontainer/docker-compose.devcontainer.yml | grep cached
# Should show: - ..:/workspace:cached
```

---

## Contributing

Improvements to this dev container setup are welcome!

**Areas for contribution**:

- Performance optimizations
- Additional shell aliases
- Better error messages
- Windows-specific improvements
- Documentation enhancements

See [../README.md#contribute](../README.md#contribute) for contribution guidelines.

---

**Happy coding! 🚀**

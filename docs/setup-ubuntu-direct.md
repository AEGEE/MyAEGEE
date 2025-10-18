# Direct Docker Setup on Ubuntu 24.04

Complete guide for running MyAEGEE directly on Ubuntu 24.04 with Docker, without Vagrant/VirtualBox overhead.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Architecture](#architecture)
- [Daily Usage](#daily-usage)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What is Direct Docker?

Direct Docker runs MyAEGEE containers natively on your Ubuntu system without virtualization:

```
Traditional (Vagrant):     Direct Docker:
┌─────────────────────┐   ┌─────────────────────┐
│   Your Ubuntu PC    │   │   Your Ubuntu PC    │
│  ┌───────────────┐  │   │  ┌───────────────┐  │
│  │  VirtualBox   │  │   │  │ Docker Engine │  │
│  │  ┌─────────┐  │  │   │  │  ┌─────────┐  │  │
│  │  │ Vagrant │  │  │   │  │  │Container│  │  │
│  │  │  ┌───┐  │  │  │   │  │  │  ┌───┐  │  │  │
│  │  │  │App│  │  │  │   │  │  │  │App│  │  │  │
│  │  │  └───┘  │  │  │   │  │  │  └───┘  │  │  │
│  │  └─────────┘  │  │   │  │  └─────────┘  │  │
│  └───────────────┘  │   │  └───────────────┘  │
└─────────────────────┘   └─────────────────────┘
```

### Benefits

| Aspect           | Vagrant               | Direct Docker | Improvement |
| ---------------- | --------------------- | ------------- | ----------- |
| **Setup Time**   | 15-20 min             | 8-12 min      | ~40% faster |
| **Memory Usage** | 8-12 GB               | 5-7 GB        | ~35% less   |
| **Hot Reload**   | 5-10 sec              | <3 sec        | 3x faster   |
| **Disk I/O**     | Slow (shared folders) | Native        | Much faster |
| **CPU Overhead** | VM + Docker           | Docker only   | Lower       |

### Should You Use Direct Docker?

✅ **Yes, if you:**

- Run Ubuntu 24.04 LTS (or willing to upgrade)
- Want better performance and faster development
- Prefer native Docker commands
- Have at least 20GB free disk space

⚠️ **Stick with Vagrant if you:**

- Use Windows, macOS, or other Linux distros
- Already have working Vagrant setup and it's fast enough
- Need VirtualBox for other projects

---

## Quick Start

For experienced users, the TL;DR version:

```bash
# 1. Clone repository
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE

# 2. Run bootstrap (one-time setup)
./scripts-ubuntu/bootstrap.sh
# Log out and back in after bootstrap

# 3. Start services
make start

# 4. Access application
open http://my.appserver.test
```

**Total time**: ~10-15 minutes (first run)

For detailed step-by-step instructions, continue reading.

---

## Detailed Setup

### Prerequisites

#### System Requirements

- **OS**: Ubuntu 24.04 LTS (x86_64)
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 20GB free space minimum
- **CPU**: 4 cores recommended

Check your system:

```bash
# Ubuntu version
lsb_release -a

# Available RAM
free -h

# Free disk space
df -h /

# CPU cores
nproc
```

#### User Requirements

- Sudo access (for Docker installation and /etc/hosts)
- Internet connection (for package installation)

### Step 1: Clone Repository

Clone the MyAEGEE repository with all submodules:

```bash
cd ~/
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE
```

**Important**: The `--recursive` flag clones all microservice submodules.

If you already cloned without `--recursive`:

```bash
git submodule update --init --recursive
```

### Step 2: Run Bootstrap Script

The bootstrap script automates the entire setup:

```bash
./scripts-ubuntu/bootstrap.sh
```

**What it does** (7 steps, ~8-12 minutes):

1. **Install System Dependencies**

   - Checks for git, make, curl, build-essential, ca-certificates
   - Offers to install missing packages
   - Uses apt-get with your permission

2. **Check Prerequisites**

   - Validates Ubuntu 24.04
   - Checks sudo access
   - Verifies disk space (≥20GB)
   - Tests internet connectivity
   - Detects port conflicts

3. **Install Docker**

   - Adds Docker official repository
   - Installs Docker Engine 24.0+
   - Installs Docker Compose V2 plugin
   - Starts and enables Docker daemon

4. **Setup Permissions**

   - Adds your user to docker group
   - Configures group membership

5. **Configure DNS**

   - Updates /etc/hosts with MyAEGEE domains
   - Adds: my.appserver.test, oms-core.appserver.test, etc.

6. **Setup Environment**

   - Copies .env.example to .env
   - Sets MYAEGEE_ENVIRONMENT=direct

7. **Validate Installation**
   - Verifies Docker is accessible
   - Checks Docker Compose V2
   - Validates port availability
   - Confirms DNS configuration

### Step 3: Log Out and Back In

**Important**: You must log out and log back in for Docker group membership to take effect.

```bash
# Option 1: Full logout (recommended)
# Log out of your desktop session, then log back in

# Option 2: Temporary (current terminal only, for testing)
newgrp docker
```

Verify Docker access:

```bash
docker ps
# Should show empty list (no permission error)
```

### Step 4: Start Services

Start all MyAEGEE services:

```bash
make start
```

**First run** (~5-10 minutes):

- Builds Docker images for all services
- Downloads base images (Node.js, PostgreSQL, etc.)
- Initializes databases
- Starts ~15-20 containers

**Subsequent runs** (~1-2 minutes):

- Uses cached images
- Starts containers quickly

Monitor progress:

```bash
# In another terminal
make monitor
```

### Step 5: Verify Installation

Check containers are running:

```bash
docker ps
```

You should see:

- `traefik` - Reverse proxy
- `postgres-core`, `postgres-events`, etc. - Databases
- `oms-core`, `oms-events`, etc. - Application services
- `mailer` - Email service
- `gsuite-wrapper` - Google integration
- `portainer` - Management UI

Access the application:

- **Frontend**: http://my.appserver.test
- **Traefik Dashboard**: http://traefik.appserver.test
- **Portainer**: http://portainer.appserver.test

Default credentials:

- Username: `admin@aegee.org`
- Password: `password`

---

## Architecture

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Your Browser                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Traefik (Port 80/443)                     │
│              Reverse Proxy & Load Balancer                   │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│Core │  │Events│ │Statu-│ │ ... │  │Front│
│     │  │      │ │tory  │  │     │  │ end │
└──┬──┘  └──┬───┘ └──┬───┘  └─────┘  └─────┘
   │        │        │
   ▼        ▼        ▼
┌─────┐  ┌─────┐  ┌─────┐
│PG-1 │  │PG-2 │  │PG-3 │  ... (PostgreSQL per service)
└─────┘  └─────┘  └─────┘
```

### Directory Structure

```
MyAEGEE/
├── core/                    # Core service (users, bodies, circles)
├── events/                  # Events service
├── statutory/               # Statutory events service
├── discounts/               # Discounts service
├── summeruniversity/        # Summer university service
├── knowledge/               # Knowledge base
├── frontend/                # Vue.js frontend
├── mailer/                  # Email service (Elixir)
├── gsuite-wrapper/          # Google Workspace integration
├── scripts-ubuntu/          # Direct Docker setup scripts
│   ├── bootstrap.sh         # Main setup orchestrator
│   ├── install-docker.sh    # Docker installation
│   ├── check-prerequisites.sh
│   ├── setup-permissions.sh
│   ├── setup-hosts.sh
│   ├── setup-environment.sh
│   ├── validate-installation.sh
│   ├── check-port-conflicts.sh
│   └── migrate-from-vagrant.sh
├── Makefile                 # Command interface
├── helper.sh                # Docker command wrapper
├── start.sh                 # Environment detection & bootstrap
└── .env                     # Configuration (created from .env.example)
```

### Environment Detection

The system automatically detects whether you're in Vagrant or direct Docker:

```bash
# helper.sh checks:
is_vagrant() {
    [ -d /vagrant ] || [ "$VAGRANT" = "true" ]
}

# Then routes commands appropriately:
if is_vagrant; then
    # In VM: execute directly
    docker compose $CMD
else
    # On host: execute directly (no SSH)
    docker compose $CMD
fi
```

---

## Daily Usage

### Starting Services

```bash
make start        # Start all services
make stop         # Stop all services
make restart      # Restart all services
```

### Monitoring

```bash
make logs         # Show all logs
make monitor      # Live tail all logs
make monitor core # Monitor specific service
```

### Development

```bash
# Edit files in your favorite IDE
vim core/lib/server.js

# Changes are hot-reloaded automatically (<3s)
# Watch logs to see restart
make monitor core
```

### Database Access

```bash
# Access core database
docker exec -it postgres-core psql -U postgres -d myaegee-core

# List tables
\dt

# Query data
SELECT * FROM users LIMIT 5;

# Exit
\q
```

### Running Commands in Services

```bash
# Run npm test in core
./helper.sh --execute core "npm test"

# Install packages
./helper.sh --execute core "npm install lodash"

# Run database migration
./helper.sh --execute events "npm run db:migrate"
```

### Cleaning Up

```bash
make clean        # Stop and remove containers (keeps data)
make clean-data   # Remove volumes (WARNING: deletes data)
docker system prune -a  # Remove unused images/networks
```

---

## Advanced Configuration

### Port Configuration

Edit `.env` to customize ports:

```bash
# Change Traefik ports (if conflicts)
TRAEFIK_HTTP_PORT=8080
TRAEFIK_HTTPS_PORT=8443

# Change Portainer port
PORTAINER_PORT=9091

# Change service-specific PostgreSQL ports
CORE_POSTGRES_PORT=5433
EVENTS_POSTGRES_PORT=5434
```

Then restart:

```bash
make restart
```

### Resource Limits

Set Docker resource limits in `.env`:

```bash
# Limit memory for services
CORE_MEMORY_LIMIT=512m
EVENTS_MEMORY_LIMIT=512m

# Limit CPU
CORE_CPU_LIMIT=1.0
```

### Development Settings

Enable debug mode:

```bash
# In .env
NODE_ENV=development
DEBUG=myaegee:*
LOG_LEVEL=debug
```

### Hot Reload Configuration

If hot reload is slow, increase inotify limits:

```bash
# Check current limit
sysctl fs.inotify.max_user_watches

# Increase limit
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Restart services
make restart
```

---

## Troubleshooting

For comprehensive troubleshooting, see:

- **docs/troubleshooting-ubuntu.md** - Complete troubleshooting guide

### Quick Fixes

| Problem              | Solution                            |
| -------------------- | ----------------------------------- |
| Port 80/443 in use   | `sudo systemctl stop apache2 nginx` |
| Can't access Docker  | Log out and back in                 |
| Services won't start | `make clean && make start`          |
| Hot reload slow      | Increase inotify limits (see above) |
| Out of disk space    | `docker system prune -a`            |

### Common Issues

**"Cannot connect to Docker daemon"**:

```bash
# Restart Docker
sudo systemctl restart docker

# Check status
sudo systemctl status docker
```

**"Port already in use"**:

```bash
# Check what's using the port
sudo lsof -i :80

# Stop conflicting service
sudo systemctl stop apache2
```

**Services fail to start**:

```bash
# Check logs
make logs

# Restart specific service
make restart core
```

---

## Migration from Vagrant

If you have an existing Vagrant setup with data:

See **docs/migration-vagrant-to-docker.md** for complete guide.

Quick migration:

```bash
# 1. Ensure Vagrant is running
vagrant up

# 2. Run migration
./scripts-ubuntu/migrate-from-vagrant.sh

# 3. Start direct Docker
make start
```

---

## Next Steps

- Read the [Vagrant vs Direct Docker comparison](vagrant-vs-direct-docker.md)
- Check [troubleshooting guide](troubleshooting-ubuntu.md) for common issues
- See [migration guide](migration-vagrant-to-docker.md) if coming from Vagrant
- Join AEGEE-Europe technical community for support

**Happy developing! 🚀**

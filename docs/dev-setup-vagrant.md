# MyAEGEE Development Setup - Vagrant

**Note**: Vagrant setup is still supported but **VS Code Dev Containers are now recommended** for easier setup and better development experience. See [dev-setup-devcontainer.md](dev-setup-devcontainer.md) for the modern approach.

This guide covers the traditional Vagrant-based development environment setup.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Linux](#linux)
  - [Windows](#windows)
  - [macOS](#macos)
- [Accessing the System](#accessing-the-system)
- [URL Mapping Configuration](#url-mapping-configuration)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

Install in this order:

1. **Git** - https://git-scm.com/downloads

   - Version control system (you may already have this)

2. **VirtualBox** - https://www.virtualbox.org/wiki/Downloads

   - Creates and manages virtual machines
   - Download for your platform (Windows/Mac/Linux)

3. **Vagrant** - https://www.vagrantup.com/downloads.html
   - Manages VM configuration and provisioning
   - Requires VirtualBox to be installed first

### System Requirements

- **RAM**: Minimum 3GB physical RAM (VM requires 2GB)
- **Disk**: ~20GB free space
- **CPU**: Virtualization support enabled in BIOS

**Note**: Even if you have Linux, using Vagrant is **strongly recommended** to ensure consistent development environment across all platforms.

### Alternative: Without Vagrant (Not Recommended)

If you choose to skip Vagrant and install Docker directly on your host:

- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- Follow the Docker Compose installation instructions: https://docs.docker.com/compose/install/
- **Warning**: You'll need to handle OS-specific differences yourself (grep versions on Mac/Linux, path formats on Windows, etc.)
- **Limited support**: If you encounter issues, troubleshooting help will be limited

---

## Installation

### Linux

> On the HOST (your machine)

```bash
# Clone the repository with submodules
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE

# Run the start script
./start.sh
```

**URL Mapping for Linux**: Handled automatically by `start.sh`.

**Wait time**: ~20 minutes for first-time setup. A success message will appear when complete.

**Note**: Some red output is normal during setup. Only worry if the VERY last message starts with "ERROR".

### Windows

> On the HOST (your machine)

```bash
# Clone the repository with submodules
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE
```

**URL Mapping for Windows**: Must be configured manually

1. Run `run_as_win_administrator.bat` (right-click → "Run as administrator")
2. It will open Notepad with your hosts file AND show you the line to add
3. Add this line to the end of the hosts file:
   ```
   192.168.168.168 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test pgadmin.appserver.test
   ```
4. Delete the file `Vagrantfile` and rename `Vagrantfile.windows` to `Vagrantfile`
5. Save and close Notepad

**If the script doesn't work**, see [Manual Hosts File Editing](#manual-hosts-file-editing) below.

Once hosts file is configured:

```bash
vagrant up
```

**Wait time**: ~25 minutes for first-time setup.

### macOS

> On the HOST (your machine)

```bash
# Clone the repository with submodules
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE

# Run the start script
./start.sh
```

**URL Mapping for macOS**: Handled automatically by `start.sh`.

**Wait time**: ~20 minutes for first-time setup.

---

## Accessing the System

### 1. Via Terminal (SSH into VM)

Connect to the GUEST (virtual machine):

```bash
# From your HOST terminal
vagrant ssh

# You're now inside the VM where Docker runs
```

Example session:

```
username@computername:~/Documents/aegee/MyAEGEE$ vagrant ssh
Welcome to Ubuntu 18.04.4 LTS (GNU/Linux 4.15.0-111-generic x86_64)
[... system info ...]

appserver[/vagrant]$ [stable !?]
```

Now you can run Docker commands:

```bash
# Check running containers
docker ps

# View logs
make monitor

# Manage services
make start
make stop
make restart
```

### 2. Via Web Browser

Access services from your HOST web browser at these URLs:

| Service           | URL                             | Description                            |
| ----------------- | ------------------------------- | -------------------------------------- |
| **MyAEGEE App**   | http://my.appserver.test        | Main application (frontend)            |
| **Traefik**       | http://traefik.appserver.test   | Routing dashboard (quick health check) |
| **Portainer**     | http://portainer.appserver.test | Docker container management (visual)   |
| **pgAdmin**       | http://pgadmin.appserver.test   | PostgreSQL database administration     |
| **Core API**      | http://core.appserver.test      | Core microservice API                  |
| **Events API**    | http://events.appserver.test    | Events microservice API                |
| **Statutory API** | http://statutory.appserver.test | Statutory microservice API             |
| **Discounts API** | http://discounts.appserver.test | Discounts microservice API             |
| **Website**       | http://www.appserver.test       | Public website (WordPress)             |
| **Wiki**          | http://wiki.appserver.test      | AEGEE Wiki (MediaWiki)                 |

**Test if system is up**:

- Navigate to **http://my.appserver.test** - Should load the MyAEGEE application
- Navigate to **http://traefik.appserver.test** - Should show Traefik dashboard
- Navigate to **http://portainer.appserver.test** - Should show Portainer login

**HOORAY! YOUR SYSTEM IS UP!** 🎉

---

## URL Mapping Configuration

### Why URL Mapping is Needed

Vagrant creates a VM with IP `192.168.168.168`. To access services with human-readable names (like `my.appserver.test`), your HOST machine needs to know that these names point to `192.168.168.168`.

### Automatic Configuration (Linux/macOS)

The `start.sh` script automatically adds entries to `/etc/hosts`.

### Manual Hosts File Editing

If automatic configuration fails, manually edit the hosts file:

**Location**:

- **Linux/macOS**: `/etc/hosts`
- **Windows**: `C:\Windows\System32\drivers\etc\hosts`

**Add this line**:

```
192.168.168.168 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test pgadmin.appserver.test
```

#### Windows Write Permission Issue

Windows may restrict editing the hosts file. Workaround ([source](https://windowsreport.com/access-denied-hosts-windows-10/)):

1. Go to `C:\Windows\System32\drivers\etc\` and locate `hosts` file
2. Copy it to your Desktop (or any folder you can access)
3. Open the hosts file with Notepad
4. Make the necessary changes (add the line above)
5. Move the hosts file back to `C:\Windows\System32\drivers\etc\`

#### Without Vagrant (Pure Docker)

If you installed Docker directly without Vagrant:

**Add this line instead**:

```
127.0.0.1 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test pgadmin.appserver.test
```

(Uses `127.0.0.1` instead of `192.168.168.168`)

---

## Common Commands

### On the HOST (Your Machine)

```bash
# Start the VM and services
./start.sh

# Start with production-mode services (faster, for integration work)
./start.sh --fast

# Reset everything (deletes data, recreates VM)
./start.sh --reset

# Skip Vagrant, use Docker directly (not recommended)
./start.sh --no-vagrant

# Connect to the VM
vagrant ssh

# Stop the VM (saves state)
vagrant halt

# Restart the VM
vagrant reload

# Destroy the VM completely
vagrant destroy
```

### On the GUEST (Inside VM via `vagrant ssh`)

```bash
# Start all services
make start

# Stop all services
make stop

# Restart all services
make restart

# View logs for all services
make monitor

# Rebuild containers
make build

# Update to latest versions
make live-refresh

# Check running containers
docker ps

# View logs for specific service
./helper.sh --monitor core events frontend

# Execute command in container
./helper.sh --execute core npm run db:migrate
```

### Makefile Targets

| Command             | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `make bootstrap`    | First-time setup: init + build + start (auto-run by Vagrant) |
| `make init`         | Initialize system configuration                              |
| `make build`        | Build containers for enabled services                        |
| `make start`        | Start all enabled services                                   |
| `make stop`         | Stop all services                                            |
| `make restart`      | Restart all services                                         |
| `make monitor`      | View logs from all services                                  |
| `make live-refresh` | Update containers to latest version and restart              |
| `make bump`         | Update git submodules (development only)                     |

---

## Configuration

### .env File

The `.env` file controls system behavior:

```bash
# Enable/disable specific services (colon-separated)
ENABLED_SERVICES=core:frontend:events:statutory:discounts

# Runtime environment (development/production)
MYAEGEE_ENV=development

# Subdomain configuration
SUBDOMAIN_FRONTEND=my
SUBDOMAIN_CORE=core
# ... etc
```

**Example: Disable a problematic service**

1. Edit `.env`
2. Remove service from `ENABLED_SERVICES`
3. Stop and remove container (on GUEST):
   ```bash
   docker stop myaegee_discounts_1
   docker rm myaegee_discounts_1
   ```

**Example: Add a new service**

1. Edit `.env`
2. Add service to `ENABLED_SERVICES`: `ENABLED_SERVICES=core:frontend:mynewservice`
3. Run `make start` (on GUEST)

### File Mounting

Files in your HOST folder `MyAEGEE/` are mounted inside the GUEST at `/vagrant/`.

**This means**:

- ✅ Edit files on HOST with your IDE
- ✅ Changes immediately visible in GUEST
- ✅ No need to transfer files or learn new tools
- ✅ Use your familiar development environment

**Important**: Use the [EditorConfig](https://editorconfig.org/#download) extension in your IDE to avoid line-ending issues (especially on Windows).

---

## Troubleshooting

### VM Won't Start

**Issue**: Vagrant fails during `vagrant up`

**Solutions**:

```bash
# Check VirtualBox is installed
vboxmanage --version

# Check Vagrant is installed
vagrant --version

# Destroy and recreate VM
vagrant destroy -f
vagrant up

# Check virtualization is enabled in BIOS
# (varies by system)
```

### Services Not Running

**Issue**: Connected to VM but services aren't running

```bash
# On GUEST - check what's running
docker ps

# Check if Docker is running
docker info

# Try starting services
make start

# View logs for errors
make monitor

# Check current-config.yml for configuration
cat /vagrant/current-config.yml
```

### Cannot Access Services in Browser

**Issue**: URLs like `my.appserver.test` don't work

**Check**:

1. **Hosts file configured?**

   ```bash
   # Linux/macOS
   cat /etc/hosts | grep appserver

   # Windows
   type C:\Windows\System32\drivers\etc\hosts | findstr appserver
   ```

   Should show: `192.168.168.168 appserver.test my.appserver.test ...`

2. **VM IP correct?**

   ```bash
   # On HOST
   vagrant ssh -c "ip addr show"
   # Should include 192.168.168.168
   ```

3. **Services running?**

   ```bash
   # On GUEST
   docker ps | grep frontend
   ```

4. **Traefik working?**
   - Visit http://traefik.appserver.test
   - Should show dashboard with services

### NGINX 403 Forbidden Error

**Issue**: Visiting `my.appserver.test` shows "403 Forbidden"

**Solution**: Run frontend helper commands (first-time setup)

```bash
# On GUEST
vagrant ssh
cd /vagrant/frontend
# Follow steps from orchestrate_docker.sh for frontend helper
```

### Port Conflicts

**Issue**: Services can't start due to port conflicts

**Solution**: Check what's using ports on GUEST

```bash
# On GUEST
docker ps  # Check for conflicting containers
lsof -i :80  # Check port 80
lsof -i :443  # Check port 443
```

### Database Issues

**Reset Database**:

Option 1 - Via pgAdmin:

1. Enable dev-tools: Add to `ENABLED_SERVICES` in `.env`
2. Open http://pgadmin.appserver.test
3. Configure pgAdmin:
   - Host: `postgres-core` (or `postgres-events`, etc.)
   - Username/Password: Check `.env` file or `current-config.yml`
4. Delete database
5. Restart service: `make restart`

Option 2 - Via Portainer:

1. Open http://portainer.appserver.test
2. Stop and remove database container
3. Stop and remove service container
4. Run `make start` - will recreate everything

**Note**: Service must be restarted after deleting DB, as it runs migrations on startup.

### Orphan Container Warnings

**Issue**: Warning about "orphan containers" when starting services

**Cause**: You removed services from `ENABLED_SERVICES` but didn't stop them first

**Solution**: This is harmless, but to clean up:

```bash
# On GUEST
docker ps -a  # List all containers
docker stop <container_name>
docker rm <container_name>

# Or remove all stopped containers
docker container prune
```

### VM Performance Issues

**Solutions**:

1. **Increase VM resources** (edit `Vagrantfile`):

   ```ruby
   config.vm.provider "virtualbox" do |vb|
     vb.memory = "4096"  # Increase RAM
     vb.cpus = 4         # Increase CPU cores
   end
   ```

2. **Close other applications** on HOST

3. **Use `--fast` mode** for production-like services:

   ```bash
   ./start.sh --fast
   ```

4. **Disable unused services** in `.env`:
   ```bash
   ENABLED_SERVICES=core:frontend  # Minimal setup
   ```

### Helper Script Issues

**Monitor specific services**:

```bash
./helper.sh --monitor core events frontend
```

**Execute command in container**:

```bash
./helper.sh --execute core npm run db:migrate
```

---

## Default Credentials

Test users (all have password `5ecr3t5ecr3t`):

| Email                        | Role                       |
| ---------------------------- | -------------------------- |
| `admin@example.com`          | Admin user                 |
| `board@example.com`          | Board member of antenna    |
| `member@example.com`         | Regular antenna member     |
| `not-confirmed@example.com`  | Unconfirmed member         |
| `password-reset@example.com` | Member who requested reset |
| `suspended@example.com`      | Suspended member           |

**Tokens**:

- Password reset: `5ecr3t`
- Email confirmation: `5ecr3t`

**Note**: If you use `./start.sh --fast`, Core runs in production mode WITHOUT seed users. Register manually if needed.

---

## Comparison with Dev Containers

Still deciding between Vagrant and Dev Containers? See comparison in main [README.md](../README.md#development-setup-comparison).

**Quick summary**:

- **Vagrant**: Traditional VM approach, proven and stable
- **Dev Containers**: Modern approach, simpler setup, better VS Code integration
- **Both**: Fully supported, use whichever you prefer

---

## Need More Help?

- **Issue Tracker**: https://myaegee.atlassian.net/projects/MEMB/issues
- **Confluence**: https://myaegee.atlassian.net/wiki/spaces/GENERAL/overview
- **GitHub Discussions**: https://github.com/AEGEE/MyAEGEE/discussions

---

**Last Updated**: October 19, 2025  
**Maintained for backward compatibility per FR-014**

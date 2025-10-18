# Quickstart: Direct Docker Development on Ubuntu 24.04

**Last Updated**: 2025-10-18  
**Status**: Implementation Guide  
**Prerequisites**: Ubuntu 24.04 LTS (x86_64)

This guide shows you how to run MyAEGEE directly on your Ubuntu 24.04 machine using Docker, without the overhead of Vagrant and VirtualBox.

## 🎯 What You'll Get

- **Faster setup**: <10 minutes from zero to running services
- **Better performance**: ~30% less memory usage, native Docker performance
- **Instant hot reload**: <3 seconds for code changes to reflect
- **Simpler workflow**: No VM layer, direct interaction with Docker

## ⚡ Quick Setup (TL;DR)

If you're experienced with Docker:

```bash
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE
./scripts-ubuntu/bootstrap.sh
make start
```

Open http://my.appserver.test in your browser.

## 📋 Prerequisites

### System Requirements

- **Operating System**: Ubuntu 24.04 LTS (x86_64)
- **RAM**: 8GB minimum, 16GB recommended
- **Disk Space**: 20GB free
- **CPU**: 4 cores minimum (for reasonable build times)
- **Network**: Unrestricted access to Docker Hub, GitHub

### What's Installed

The bootstrap script will automatically install:

- Docker Engine 24.0+ (from official Docker repository)
- Docker Compose V2 plugin
- Build tools (make, git, curl)
- Development dependencies

### Before You Begin

1. **Update your system**:

   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Ensure you have sudo access**:

   ```bash
   sudo -v
   ```

3. **Check disk space**:
   ```bash
   df -h ~
   # You should have at least 20GB free
   ```

## 🚀 Step-by-Step Setup

### Step 1: Clone the Repository

```bash
# Clone with all submodules
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE

# If you already cloned without --recursive:
git submodule update --init --recursive
```

### Step 2: Run Bootstrap Script

The bootstrap script handles everything: Docker installation, permission setup, and environment configuration.

```bash
./scripts-ubuntu/bootstrap.sh
```

**What happens during bootstrap:**

1. ✅ Checks if you're on Ubuntu 24.04
2. ✅ Installs Docker Engine from official repository
3. ✅ Adds you to the `docker` group
4. ✅ Installs Docker Compose V2
5. ✅ Checks for port conflicts
6. ✅ Configures `/etc/hosts` for local development
7. ✅ Creates `.env` file from template
8. ✅ Increases inotify limits (for hot reload)
9. ✅ Validates installation

**Expected output:**

```
🔍 Checking prerequisites...
✓ Running on Ubuntu 24.04
✓ All prerequisites met

📦 Installing Docker...
✓ Docker Engine 24.0.7 installed
✓ Docker Compose V2 installed

👤 Configuring permissions...
✓ Added to docker group

⚙️  Configuring environment...
✓ /etc/hosts configured
✓ .env file created
✓ inotify limits increased

✅ Bootstrap complete! Next steps:
   1. Log out and log back in (or run: newgrp docker)
   2. Run: make start
```

### Step 3: Activate Docker Group (IMPORTANT)

After bootstrap, you **must** log out and log back in for the docker group to take effect.

**Option A: Log out and log back in (Recommended)**

```bash
# Close your terminal and log out of your desktop session
# Then log back in and return to the MyAEGEE directory
```

**Option B: Use newgrp (for testing only)**

```bash
# This only works in the current terminal
newgrp docker
```

### Step 4: Start Services

```bash
make start
```

**What happens:**

1. Pulls Docker images (first time only, ~5-10 minutes)
2. Creates Docker networks
3. Starts PostgreSQL databases for each service
4. Starts Node.js microservices (core, events, statutory, etc.)
5. Starts Vue.js frontend
6. Starts Traefik reverse proxy

**Expected output:**

```
Starting MyAEGEE services...
[+] Running 15/15
 ✔ Network myaegee_default        Created
 ✔ Container postgres-core        Started
 ✔ Container postgres-events      Started
 ✔ Container core                 Started
 ✔ Container events               Started
 ✔ Container frontend             Started
 ✔ Container traefik              Started
...

✅ All services started successfully!

Access your services:
  Frontend:         http://my.appserver.test
  Traefik Dashboard: http://traefik.appserver.test
```

### Step 5: Verify Installation

1. **Check container status**:

   ```bash
   docker ps
   # You should see ~15 containers running
   ```

2. **Check service logs**:

   ```bash
   make logs
   # Should show logs from all services
   ```

3. **Open in browser**:

   - Frontend: http://my.appserver.test
   - Traefik: http://traefik.appserver.test

4. **Test login**:
   - Default admin credentials are in `.env` file
   - Check `docs/` for test user accounts

## 🛠️ Common Tasks

### Starting Services

```bash
# Start all services
make start

# Start in background (detached mode)
make start-daemon

# Start specific service
docker-compose up -d core
```

### Stopping Services

```bash
# Stop all services
make stop

# Stop and remove containers
make down

# Stop and remove everything (including volumes - DESTRUCTIVE)
make clean
```

### Viewing Logs

```bash
# All services
make logs

# Specific service
docker-compose logs -f core

# Last 100 lines
docker-compose logs --tail=100
```

### Running Database Migrations

```bash
# Core service
docker-compose exec core npm run db:migrate

# Events service
docker-compose exec events npm run db:migrate

# All services
make db-migrate
```

### Installing Dependencies

If you add packages to `package.json`:

```bash
# Install in specific service
docker-compose exec core npm install

# Rebuild service to persist
docker-compose up -d --build core
```

### Accessing Service Shell

```bash
# Bash in core service
docker-compose exec core bash

# PostgreSQL CLI for core database
docker-compose exec postgres-core psql -U aegee -d core
```

### Hot Reload Testing

Edit a file and watch for automatic reload:

```bash
# Terminal 1: Watch logs
docker-compose logs -f core

# Terminal 2: Make a change
echo "// Test change" >> core/lib/server.js

# Terminal 1 should show:
# [nodemon] restarting due to changes...
```

## 🔧 Troubleshooting

### Port Conflicts

**Symptom**: Error "port is already allocated"

**Solution**:

```bash
# Check what's using the port
sudo ss -tulnp | grep :80

# Stop the conflicting service
sudo systemctl stop apache2   # Example for Apache

# Or configure MyAEGEE to use different ports in .env
```

### Permission Denied on Docker Commands

**Symptom**: "permission denied while trying to connect to Docker daemon"

**Cause**: You're not in the docker group yet

**Solution**:

```bash
# Verify you're in docker group
groups | grep docker

# If not there, run bootstrap again
./scripts-ubuntu/bootstrap.sh

# Then log out and back in
```

### Services Won't Start

**Symptom**: Containers exit immediately

**Solution**:

```bash
# Check logs for error messages
docker-compose logs core

# Common issues:
# 1. Missing .env file
cp .env.example .env

# 2. Database not ready (wait a few seconds)
docker-compose up -d postgres-core
sleep 10
docker-compose up -d core

# 3. Port conflicts (see above)
```

### DNS Resolution Fails

**Symptom**: "curl: (6) Could not resolve host: my.appserver.test"

**Solution**:

```bash
# Verify /etc/hosts entries
grep appserver /etc/hosts

# Should show:
# 127.0.0.1 appserver.test my.appserver.test traefik.appserver.test

# If missing, run:
sudo ./scripts-ubuntu/setup-hosts.sh
```

### Slow Hot Reload

**Symptom**: Changes take >10 seconds to reflect

**Solution**:

```bash
# Check inotify limits
cat /proc/sys/fs/inotify/max_user_watches

# Should be 524288 or higher
# If lower, increase:
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Docker Out of Space

**Symptom**: "no space left on device"

**Solution**:

```bash
# Check Docker disk usage
docker system df

# Clean up unused containers, images, volumes
docker system prune -a --volumes

# WARNING: This removes ALL unused Docker data
```

### Traefik Shows 404

**Symptom**: "404 page not found" on my.appserver.test

**Cause**: Service not registered with Traefik yet

**Solution**:

```bash
# Check Traefik dashboard
# Open http://traefik.appserver.test

# Verify service is running
docker ps | grep frontend

# Check service labels
docker inspect frontend | grep -A 10 Labels

# Restart Traefik
docker-compose restart traefik
```

## 🔄 Migrating from Vagrant

If you were using Vagrant before:

### Preserve Your Data

```bash
# 1. Ensure Vagrant VM is running
vagrant up

# 2. Run migration tool
./scripts-ubuntu/migrate-from-vagrant.sh

# This exports databases and uploaded files from Vagrant
# and imports them to Docker volumes
```

### Side-by-Side Testing

You can run both Vagrant and direct Docker simultaneously (on different ports):

```bash
# Vagrant uses ports 80, 443 (inside VM mapped from host)
# Direct Docker uses same ports on host

# To avoid conflicts, stop Vagrant:
vagrant halt

# Run direct Docker
make start
```

### Switch Back to Vagrant

```bash
# Stop direct Docker
make stop

# Start Vagrant
vagrant up

# Your Vagrant data is untouched
```

## 📚 Next Steps

### Development Workflow

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make changes**: Edit files in any service (core/, events/, frontend/, etc.)

3. **Hot reload**: Changes automatically reload (no need to restart)

4. **Run tests**:

   ```bash
   docker-compose exec core npm test
   ```

5. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat: add my feature"
   git push origin feature/my-new-feature
   ```

### Learn More

- **Full documentation**: See `README.md`
- **Architecture**: See `docs/architecture.md`
- **API documentation**: See individual service `README.md` files
- **Contributing**: See `CONTRIBUTING.md`

### Advanced Topics

- **Custom service development**: `docs/adding-a-service.md`
- **Database management**: `docs/database.md`
- **Deployment**: `docs/deployment.md`
- **Performance tuning**: `docs/performance.md`

## 🆘 Getting Help

- **GitHub Issues**: https://github.com/AEGEE/MyAEGEE/issues
- **Slack**: #developers channel
- **Documentation**: https://oms-project.atlassian.net

## ✅ Success Criteria

You're all set when:

- ✅ All containers are running (`docker ps` shows ~15 containers)
- ✅ Frontend loads at http://my.appserver.test
- ✅ You can log in with test credentials
- ✅ Code changes trigger automatic reload (<3 seconds)
- ✅ No errors in `docker-compose logs`

**Happy coding! 🚀**

---

## Appendix: Manual Docker Installation

If the bootstrap script fails, you can install Docker manually:

```bash
# Remove old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version

# Log out and log back in
```

## Appendix: Environment Variables

Key variables in `.env`:

```bash
# Database credentials
POSTGRES_USER=aegee
POSTGRES_PASSWORD=changeme

# Service URLs (auto-configured by bootstrap)
BASE_URL=http://appserver.test
FRONTEND_URL=http://my.appserver.test

# Service ports (internal Docker network)
CORE_PORT=4000
EVENTS_PORT=4001
STATUTORY_PORT=4002

# Hot reload settings
NODE_ENV=development
CHOKIDAR_USEPOLLING=false  # Set to true if hot reload doesn't work
```

## Appendix: Useful Make Commands

```bash
make start          # Start all services
make stop           # Stop all services
make restart        # Restart all services
make logs           # View logs from all services
make ps             # Show container status
make clean          # Remove containers, networks (keeps volumes)
make destroy        # Remove everything including volumes (DESTRUCTIVE)
make db-migrate     # Run database migrations
make db-seed        # Seed databases with test data
make test           # Run tests for all services
make lint           # Run linters
make build          # Rebuild all containers
```

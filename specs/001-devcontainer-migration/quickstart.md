# Quickstart: Dev Container Setup

**Last Updated**: 2025-10-18  
**For Feature**: 001-devcontainer-migration

## Prerequisites

Before you begin, ensure you have:

1. **Git** - Version control

   - Download: https://git-scm.com/downloads
   - Verify: `git --version`

2. **Docker Desktop** (or Docker Engine)

   - **Windows/Mac**: [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - **Linux**: [Docker Engine](https://docs.docker.com/engine/install/) + [Docker Compose](https://docs.docker.com/compose/install/)
   - Verify: `docker --version` and `docker compose version`
   - **Minimum**: Docker Desktop 4.0+, Docker Engine 20.10+

3. **Visual Studio Code**

   - Download: https://code.visualstudio.com/
   - Verify: `code --version`

4. **Dev Containers Extension for VS Code**

   - Install from: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers
   - Or in VS Code: Extensions → Search "Dev Containers" → Install

5. **System Requirements**
   - **RAM**: 8GB minimum (4GB available for Docker in minimal mode, 6GB for full mode)
   - **Disk**: 20GB free space
   - **CPU**: 2+ cores recommended

---

## Quick Start (5 Minutes)

### Step 1: Clone Repository

```bash
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE
```

**Note**: The `--recursive` flag is important to clone all microservice submodules.

### Step 2: Open in VS Code

```bash
code .
```

### Step 3: Reopen in Container

When VS Code opens, you'll see a prompt:

```
Folder contains a Dev Container configuration file.
Reopen in Container?
```

Click **"Reopen in Container"** (or press F1 → "Dev Containers: Reopen in Container")

### Step 4: Wait for Build & Startup

First time only: Container image will build (10-15 minutes)

Every time: Services will start automatically (1-2 minutes)

You'll see progress in the terminal:

```
📦 Starting Services...
✓ Databases ready
✓ Backend services ready
✓ Frontend ready

🚀 Development Environment Ready!
```

### Step 5: Access the Application

Open your browser to: **http://localhost:3000**

---

## Service URLs

Once started, access these services:

| Service           | URL                   | Purpose                          |
| ----------------- | --------------------- | -------------------------------- |
| **MyAEGEE App**   | http://localhost:3000 | Main application                 |
| Core API          | http://localhost:8084 | User, authentication, bodies API |
| Events API        | http://localhost:8085 | Events management API            |
| Statutory API     | http://localhost:8086 | Statutory events API             |
| Discounts API     | http://localhost:8087 | Discounts API                    |
| Traefik Dashboard | http://localhost:8080 | Reverse proxy admin              |
| Portainer         | http://localhost:9000 | Container management UI          |
| pgAdmin           | http://localhost:5050 | Database admin UI                |

---

## Default Credentials

### Application Login

Test users (password: `5ecr3t5ecr3t`):

- `admin@example.com` - Superadmin
- `board@example.com` - Board member
- `member@example.com` - Regular member

### pgAdmin

- **Email**: `admin@admin.com`
- **Password**: `admin`

After login, add server:

- **Host**: `postgres-core` (or `postgres-events`, etc.)
- **Username**: `postgres`
- **Password**: See `.env` file or `secrets/core-db_password`

---

## Common Commands

Open a terminal in VS Code (Terminal → New Terminal):

```bash
# View all service logs
make monitor

# View logs for specific service
./helper.sh --monitor core events frontend

# Restart all services
make restart

# Stop all services
make stop

# Start all services (if stopped)
make start

# Reset databases to seed data
make reset-db

# Execute command in a service
./helper.sh --execute core "npm test"

# Check service status
docker ps
```

---

## Minimal Mode (Low RAM)

If you have limited RAM (8GB total, <6GB available), the system will offer **minimal mode**:

**Prompt on startup**:

```
⚠️ Available RAM: 5 GB
Start in minimal mode? (Y/n)
```

**Minimal mode includes**:

- ✅ Frontend (http://localhost:3000)
- ✅ Core API (http://localhost:8084)
- ✅ Database for core
- ❌ Events, Statutory, Discounts services (disabled)
- ❌ Admin tools (disabled)

**To switch to full mode later**:

1. Close other applications to free RAM
2. Rebuild container: F1 → "Dev Containers: Rebuild Container"

---

## Troubleshooting

### Problem: "Reopen in Container" button doesn't appear

**Solution**:

1. Ensure Dev Containers extension is installed
2. Press F1 → type "Dev Containers: Reopen in Container"

### Problem: Port conflict error

**Error**: `Port 3000 already in use`

**Solution**:

```bash
# Find and stop the process using the port
lsof -ti:3000 | xargs kill -9

# Or change the port in .devcontainer/docker-compose.devcontainer.yml
```

### Problem: Out of memory

**Error**: `Container killed due to memory constraint`

**Solution**:

1. **Docker Desktop**: Settings → Resources → Memory → Increase to 6GB+
2. **Minimal Mode**: Restart container and choose minimal mode
3. **Close apps**: Free RAM by closing browsers, Slack, etc.

### Problem: Services won't start

**Symptom**: Health checks failing, services show as unhealthy

**Solution**:

```bash
# Check logs for errors
docker logs myaegee_core_1

# Try restarting just that service
docker restart myaegee_core_1

# Last resort: rebuild container
# F1 → "Dev Containers: Rebuild Container"
```

### Problem: Database connection errors

**Error**: `ECONNREFUSED` or `database does not exist`

**Solution**:

```bash
# Reset databases
make reset-db

# Or manually
docker exec myaegee_core_1 npm run db:setup
docker exec myaegee_core_1 npm run db:migrate
docker exec myaegee_core_1 npm run db:seed
```

### Problem: Code changes don't reflect

**Symptom**: Edited code but changes not visible

**Solution**:

1. **Check hot-reload**: Most services auto-reload, wait 3-5 seconds
2. **Manual restart**: `make restart`
3. **Clear cache**:

   ```bash
   # Frontend
   docker exec myaegee_frontend_1 rm -rf node_modules/.cache

   # Backend
   docker exec myaegee_core_1 npm run dev
   ```

### Problem: Build failures

**Error**: Container build fails

**Solution**:

1. **Check Docker Desktop is running**
2. **Check internet connection** (downloading images)
3. **Clear Docker cache**:
   ```bash
   docker system prune -a
   # Then rebuild: F1 → "Dev Containers: Rebuild Container"
   ```
4. **Check disk space**: Need 20GB+ free

---

## Differences from Vagrant Setup

| Aspect            | Vagrant             | Dev Containers                  |
| ----------------- | ------------------- | ------------------------------- |
| **Setup Time**    | 20-25 minutes       | 5 minutes (after initial build) |
| **Prerequisites** | VirtualBox, Vagrant | Docker, VS Code                 |
| **URLs**          | `my.appserver.test` | `localhost:3000`                |
| **Access Method** | `vagrant ssh`       | Integrated terminal             |
| **Memory**        | Fixed 2GB           | Dynamic, 4-6GB                  |
| **Platform**      | Linux VM            | Native container                |

**Migration Note**: Both setups can coexist. Vagrant users can continue using Vagrant. Dev containers are optional but recommended for easier setup.

---

## GitHub Codespaces

To use GitHub Codespaces (no local setup required):

1. Go to https://github.com/AEGEE/MyAEGEE
2. Click **Code** → **Codespaces** → **Create codespace on main**
3. Wait for build (5-10 minutes first time)
4. Services start automatically
5. Access via **Ports** tab → click port 3000 → opens in browser

**Codespace URLs**: GitHub auto-generates URLs like:

- `https://username-myaegee-3000.githubpreview.dev`

**Note**: Port forwarding is automatic in Codespaces.

---

## Next Steps

1. **Explore the code**: All services are in their respective folders (`core/`, `events/`, `frontend/`, etc.)
2. **Run tests**:
   ```bash
   cd core
   npm test
   ```
3. **Make changes**: Edit files, changes auto-reload
4. **Read documentation**:
   - [Core Service](../core/README.md)
   - [Frontend](../frontend/README.md)
   - [Events](../events/README.md)
5. **Contribution guide**: See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## Getting Help

- **Slack**: #oms-general channel
- **GitHub Issues**: https://github.com/AEGEE/MyAEGEE/issues
- **JIRA**: https://myaegee.atlassian.net/
- **Wiki**: https://myaegee.atlassian.net/wiki

**For dev container specific issues**: Include:

- OS and version
- Docker version (`docker --version`)
- VS Code version (`code --version`)
- Error messages from VS Code output panel
- Container logs (`docker logs myaegee_<service>_1`)

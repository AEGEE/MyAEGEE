# Dev Container Troubleshooting Guide

Quick reference for common dev container issues and solutions. Use Ctrl+F / Cmd+F to search for your specific error message.

## Table of Contents

- [Build & Startup Issues](#build--startup-issues)
- [Port & Network Issues](#port--network-issues)
- [Memory & Performance Issues](#memory--performance-issues)
- [Service Health Issues](#service-health-issues)
- [Database Issues](#database-issues)
- [Hot Reload Issues](#hot-reload-issues)
- [GitHub Codespaces Issues](#github-codespaces-issues)
- [Platform-Specific Issues](#platform-specific-issues)

---

## Build & Startup Issues

### Container Won't Build

**Error**: "Failed to build dev container" or "Error during container build"

**Common Causes**:

1. Docker not running
2. Insufficient disk space
3. Network issues downloading packages
4. Syntax error in Dockerfile

**Solutions**:

```bash
# 1. Check Docker is running
docker ps

# 2. Check disk space (need ~20GB free)
df -h

# 3. Clean up Docker to free space
docker system prune -af
docker volume prune

# 4. Rebuild with no cache
# In VS Code: Command Palette → "Dev Containers: Rebuild Container Without Cache"

# 5. Check Dockerfile syntax
cat .devcontainer/Dockerfile | grep -i error
```

---

### Container Starts But Services Don't

**Error**: Container running but "Service not accessible" or timeout errors

**Solutions**:

```bash
# 1. Check Docker daemon inside container
docker ps

# 2. Manually start services
cd /workspace
make start

# 3. Check service logs
make monitor

# 4. Verify Docker socket mounted
ls -la /var/run/docker.sock
# Should exist and be accessible

# 5. Check network
docker network ls | grep OMS
# Should show OMS network

# 6. Restart container
# VS Code: Command Palette → "Dev Containers: Rebuild Container"
```

---

### "Cannot connect to Docker daemon"

**Error**: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock`

**Solutions**:

```bash
# 1. Verify Docker is running on host
# Windows/Mac: Start Docker Desktop
# Linux: sudo systemctl start docker

# 2. Check socket permissions
ls -la /var/run/docker.sock
# Should be accessible by vscode user

# 3. Restart Docker Desktop (Windows/Mac)

# 4. Check docker-compose.devcontainer.yml has socket mount:
cat .devcontainer/docker-compose.devcontainer.yml | grep docker.sock
# Should show: - /var/run/docker.sock:/var/run/docker.sock
```

---

## Port & Network Issues

### Port Already in Use

**Error**: "Port 3000 is already in use" or "bind: address already in use"

**Solutions**:

```bash
# 1. Find what's using the port
lsof -i :3000              # Linux/Mac
netstat -ano | findstr :3000  # Windows PowerShell

# 2. Kill the process
kill <PID>                 # Linux/Mac
taskkill /PID <PID> /F    # Windows

# 3. Stop conflicting containers
docker ps | grep 3000
docker stop <container_name>

# 4. Change port in devcontainer.json
# Edit "forwardPorts": ["3001:3000", ...]
# Then rebuild container
```

---

### Cannot Access Services at localhost

**Error**: "Connection refused" when accessing http://localhost:3000

**Solutions**:

```bash
# 1. Check port forwarding is active
# VS Code: View → Ports tab (bottom panel)
# Should show all forwarded ports

# 2. Verify service is running
docker ps | grep frontend
# Should show container running

# 3. Check service logs
docker logs myaegee_frontend_1

# 4. Test from inside container
curl http://localhost:3000
# Should return HTML

# 5. Verify host networking
cat .devcontainer/docker-compose.devcontainer.yml | grep network_mode
# Should show: network_mode: "host"
```

---

### Port Forwarding Not Working in Codespaces

**Error**: "This site can't be reached" when clicking port URL

**Solutions**:

```bash
# 1. Check port visibility (must be public)
# In PORTS tab: Right-click port → Port Visibility → Public

# 2. Refresh the forwarded URL
# Click globe icon 🌐 to get latest URL

# 3. Check service is running
docker ps

# 4. Try different browser or incognito mode

# 5. Check Codespaces firewall settings
# GitHub Settings → Codespaces → Port Privacy
```

---

## Memory & Performance Issues

### Insufficient Memory Error

**Error**: "Insufficient RAM (XGB available, minimum 4GB required)"

**Solutions**:

```bash
# 1. Increase Docker Desktop memory allocation
# Settings → Resources → Memory → 8GB

# 2. Close memory-intensive applications
# Chrome, IDEs, virtual machines

# 3. Use minimal mode
ENABLED_SERVICES=core:frontend make restart

# 4. Upgrade Codespaces machine type
# Code → Codespaces → Change machine type → 4-core or 8-core

# 5. Check actual available RAM
free -g  # Linux
vm_stat | grep free  # Mac
```

---

### Container is Slow/Laggy

**Error**: High CPU usage, slow responses, freezing

**Solutions**:

```bash
# 1. Check resource usage
docker stats

# 2. Switch to minimal mode
make stop
ENABLED_SERVICES=core:frontend make start

# 3. Reduce running services
# Edit .env: ENABLED_SERVICES=core:frontend:events

# 4. Check disk I/O
iostat -x 1  # Linux
# Look for high %util values

# 5. Increase Docker resources
# Docker Desktop: Settings → Resources
# CPU: 4+ cores, Memory: 8GB+

# 6. Clean up Docker
docker system prune -af
```

---

### Out of Disk Space

**Error**: "no space left on device" or "write error"

**Solutions**:

```bash
# 1. Check disk usage
df -h
docker system df

# 2. Clean up Docker images/volumes
docker system prune -af --volumes

# 3. Clean up specific volumes
docker volume ls
docker volume rm <volume_name>

# 4. Increase Docker Desktop disk size
# Settings → Resources → Disk image size

# 5. Remove unused dev containers
docker ps -a
docker rm <container_id>
```

---

## Service Health Issues

### Services Fail Health Checks

**Error**: "Service health check failed" or services show as unhealthy

**Solutions**:

```bash
# 1. Check which services failed
source .devcontainer/scripts/health-check.sh
display_service_status

# 2. Check specific service logs
docker logs myaegee_core_1 --tail=100

# 3. Restart failed service
docker restart myaegee_core_1

# 4. Check database connection
docker exec myaegee_postgres-core_1 pg_isready -U postgres

# 5. Reset everything
make stop
make reset-db
make start

# 6. Check environment variables
cat .env | grep -v "^#"
```

---

### Service Stuck at "Starting..."

**Error**: Service never becomes healthy, stuck in starting state

**Solutions**:

```bash
# 1. Wait longer (first start takes time)
# First start: ~5 minutes
# Subsequent: ~2 minutes

# 2. Check service is actually running
docker ps | grep <service>

# 3. Check dependencies (database)
docker ps | grep postgres

# 4. View real-time logs
docker logs -f myaegee_core_1

# 5. Check for port conflicts
lsof -i :8084  # Check if port in use

# 6. Restart with clean state
make stop
docker rm $(docker ps -aq)
make start
```

---

## Database Issues

### "Connection refused" to Database

**Error**: ECONNREFUSED connecting to PostgreSQL

**Solutions**:

```bash
# 1. Check database container running
docker ps | grep postgres-core

# 2. Check database is ready
docker exec myaegee_postgres-core_1 pg_isready -U postgres

# 3. View database logs
docker logs myaegee_postgres-core_1

# 4. Restart database
docker restart myaegee_postgres-core_1

# 5. Check database credentials in .env
cat .env | grep DB_

# 6. Reset database
make reset-db-core
```

---

### "Database does not exist"

**Error**: database "oms-core-db" does not exist

**Solutions**:

```bash
# 1. Run migrations
cdcore
npm run db:migrate

# 2. Check database list
docker exec myaegee_postgres-core_1 psql -U postgres -l

# 3. Reset database (recreates)
make reset-db-core

# 4. Check if migration files exist
ls core/migrations/

# 5. Manually create database
docker exec myaegee_postgres-core_1 psql -U postgres -c "CREATE DATABASE \"oms-core-db\";"
```

---

### Database Has No Tables

**Error**: "relation does not exist" or empty database

**Solutions**:

```bash
# 1. Run migrations
cdcore
npm run db:migrate
npm run db:seed

# 2. Check tables exist
docker exec myaegee_postgres-core_1 psql -U postgres -d oms-core-db -c "\dt"

# 3. Reset with seed data
make reset-db-core

# 4. Check migration status
cdcore
npm run db:status
```

---

### Database Corruption

**Error**: "index is corrupted" or "could not read block"

**Solutions**:

```bash
# 1. Stop services
make stop

# 2. Remove corrupted volume
docker volume rm myaegee_postgres-core-db

# 3. Restart (recreates volume)
make start

# 4. Restore from backup (if available)
gunzip < backup.sql.gz | docker exec -i myaegee_postgres-core_1 psql -U postgres -d oms-core-db

# 5. If all else fails, reset all databases
make reset-db
```

---

## Hot Reload Issues

### Code Changes Not Reflected

**Error**: Edited files but changes not showing in browser

**Solutions**:

```bash
# 1. Hard refresh browser
# Chrome/Firefox: Ctrl+Shift+R (Windows/Linux), Cmd+Shift+R (Mac)

# 2. Check file is actually saved
# Look for dot (•) in VS Code tab title

# 3. Check workspace mount
cat .devcontainer/docker-compose.devcontainer.yml | grep workspace
# Should show: - ..:/workspace:cached

# 4. Restart development server
docker restart myaegee_frontend_1

# 5. Check nodemon/hot-reload is running
docker exec myaegee_core_1 ps aux | grep nodemon

# 6. Rebuild service
make rebuild-core  # or rebuild-frontend
```

---

### Hot Reload is Slow

**Error**: Changes take >10 seconds to appear

**Solutions**:

```bash
# 1. Check system load
top  # Look for high CPU/memory usage

# 2. Use cached volume mount (already default)
# In docker-compose: - ..:/workspace:cached

# 3. Reduce watched files (if using nodemon)
# Edit package.json nodemonConfig.ignore

# 4. Increase Docker resources
# Docker Desktop: Settings → Resources

# 5. Use minimal mode (fewer services = faster)
ENABLED_SERVICES=core:frontend make restart
```

---

## GitHub Codespaces Issues

### Codespace Creation Failed

**Error**: "Failed to create codespace" or timeout during build

**Solutions**:

```bash
# 1. Try again (transient network issues)

# 2. Check GitHub status
# Visit: https://www.githubstatus.com/

# 3. Delete and recreate
# GitHub → Code → Codespaces → Delete → Create new

# 4. Try different region
# Delete Codespace, create new (may auto-select better region)

# 5. Check prebuild status
# Repository → Actions → Check "Codespaces Prebuild" workflow
```

---

### Codespace Quota Exceeded

**Error**: "You've reached your Codespaces usage limit"

**Solutions**:

```bash
# 1. Check quota usage
# GitHub → Settings → Billing → Codespaces

# 2. Stop unused Codespaces
# GitHub → Code → Codespaces → Stop all unused

# 3. Delete old Codespaces
# GitHub → Code → Codespaces → Delete

# 4. Use smaller machine type
# When creating: Choose 2-core instead of 4-core

# 5. Upgrade GitHub plan
# Free: 120 core-hours/month
# Pro: 180 core-hours/month
```

---

### Codespace Disconnects Frequently

**Error**: "Connection lost" or "Reconnecting..."

**Solutions**:

```bash
# 1. Check internet connection
# Codespaces require stable connection

# 2. Try different network
# Switch WiFi or use ethernet

# 3. Reconnect manually
# Command Palette: "Codespaces: Reconnect"

# 4. Use browser editor instead of VS Code desktop
# github.dev or Codespaces web UI

# 5. Restart Codespace
# GitHub → Code → Codespaces → Restart
```

---

## Platform-Specific Issues

### Windows: Line Ending Issues

**Error**: "\r: command not found" or scripts fail

**Solutions**:

```bash
# 1. Convert line endings to LF
# In VS Code: Bottom right → CRLF → LF

# 2. Configure git to use LF
git config --global core.autocrlf input

# 3. Fix existing files
dos2unix .devcontainer/scripts/*.sh

# 4. Rebuild container
# Command Palette: "Dev Containers: Rebuild Container"
```

---

### macOS: Performance Issues

**Error**: Slow file system operations, high CPU

**Solutions**:

```bash
# 1. Use cached volume mounts (already default)
# In docker-compose: - ..:/workspace:cached

# 2. Increase Docker Desktop resources
# Settings → Resources → Memory: 8GB+, CPUs: 4+

# 3. Enable VirtioFS (faster file sharing)
# Docker Desktop → Experimental Features → VirtioFS

# 4. Close other apps to free RAM

# 5. Use Rosetta 2 emulation if on Apple Silicon
# Docker Desktop → Settings → Use Rosetta
```

---

### Linux: Permission Issues

**Error**: "Permission denied" writing files

**Solutions**:

```bash
# 1. Check file ownership
ls -la /workspace

# 2. Fix ownership (run inside container)
sudo chown -R vscode:vscode /workspace

# 3. Check user in container
whoami  # Should be: vscode

# 4. Add user to docker group (if needed on host)
sudo usermod -aG docker $USER
# Then log out and back in

# 5. Rebuild container with correct user
# Command Palette: "Dev Containers: Rebuild Container"
```

---

## Quick Diagnostics

Run this script for automatic problem detection:

```bash
# Quick health check
cat << 'EOF' > /tmp/diagnose.sh
#!/bin/bash
echo "=== Dev Container Diagnostics ==="
echo ""
echo "1. Docker Status:"
docker --version && docker ps || echo "❌ Docker not accessible"
echo ""
echo "2. Memory:"
free -g 2>/dev/null || vm_stat | grep free
echo ""
echo "3. Disk Space:"
df -h /workspace
echo ""
echo "4. Services:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep myaegee || echo "❌ No services running"
echo ""
echo "5. Network:"
docker network ls | grep OMS || echo "❌ OMS network missing"
echo ""
echo "6. Volumes:"
docker volume ls | grep postgres | wc -l
echo ""
echo "7. Ports:"
netstat -tuln | grep -E ':(3000|8080|8084)' || lsof -i :3000,8080,8084
echo ""
EOF

chmod +x /tmp/diagnose.sh
/tmp/diagnose.sh
```

---

## Getting More Help

### Check Logs

```bash
# All services
make monitor

# Specific service
docker logs myaegee_core_1 --tail=100 -f

# Post-start script logs
cat .devcontainer/logs/post-start-*.log

# VS Code logs
# Command Palette → "Developer: Open Logs Folder"
```

### Collect Debug Information

```bash
# System info
uname -a
docker --version
docker-compose --version

# Container info
docker ps -a
docker stats --no-stream

# Network info
docker network ls
docker network inspect OMS

# Volume info
docker volume ls
docker system df
```

### Report Issues

When reporting problems, include:

1. **Error message** (exact text)
2. **Platform** (Windows/macOS/Linux, Codespaces)
3. **Docker version**: `docker --version`
4. **Available RAM**: `free -g`
5. **Steps to reproduce**
6. **Relevant logs** (see above)

Post to:

- Issue Tracker: https://myaegee.atlassian.net/projects/MEMB/issues
- Confluence: https://myaegee.atlassian.net/wiki/spaces/GENERAL/overview

---

## Prevention Tips

### Regular Maintenance

```bash
# Weekly cleanup
docker system prune -f
docker volume prune -f

# Check for updates
docker pull mcr.microsoft.com/devcontainers/base:ubuntu-22.04
git pull origin main
git submodule update --remote

# Backup databases
make backup
```

### Best Practices

1. **Commit often** - Protects against container loss
2. **Stop Codespaces** - When not in use (saves quota)
3. **Monitor resources** - Watch RAM/disk usage
4. **Use minimal mode** - On low-spec machines
5. **Keep Docker updated** - Latest version has bug fixes
6. **Close unused apps** - Free up RAM for dev container
7. **Regular restarts** - `make restart` clears transient issues

---

**Last Updated**: October 19, 2025  
**For more help**: [Dev Container Setup Guide](dev-setup-devcontainer.md)

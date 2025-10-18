# Troubleshooting MyAEGEE on Ubuntu 24.04

This guide covers common issues when running MyAEGEE directly on Ubuntu 24.04 with Docker.

## Table of Contents

- [Port Conflicts](#port-conflicts)
- [Docker Issues](#docker-issues)
- [Permission Issues](#permission-issues)
- [Service Startup Issues](#service-startup-issues)
- [Network Issues](#network-issues)
- [Performance Issues](#performance-issues)

---

## Port Conflicts

Port conflicts are the most common issue when setting up MyAEGEE. The platform requires several ports to be available.

### Required Ports

| Port | Service    | Purpose           | Critical?       |
| ---- | ---------- | ----------------- | --------------- |
| 80   | Traefik    | HTTP proxy        | ✅ Yes          |
| 443  | Traefik    | HTTPS proxy       | ✅ Yes          |
| 5432 | PostgreSQL | Database services | ⚠️ Can conflict |
| 6379 | Redis      | Cache service     | ⚠️ Can conflict |
| 9090 | Portainer  | Management UI     | ❌ Optional     |

### Check for Port Conflicts

Run the port conflict checker:

```bash
./scripts-ubuntu/check-port-conflicts.sh
```

For interactive help with specific ports:

```bash
./scripts-ubuntu/check-port-conflicts.sh --interactive
```

### Common Port Conflicts

#### Apache or Nginx (Ports 80/443)

**Symptoms**: Error binding to ports 80 or 443 when starting Traefik

**Check if running**:

```bash
sudo systemctl status apache2
sudo systemctl status nginx
```

**Solution 1 - Stop the service** (recommended for development):

```bash
sudo systemctl stop apache2
sudo systemctl disable apache2  # Prevent auto-start on boot
```

**Solution 2 - Change MyAEGEE ports**:

Edit `.env` and add:

```bash
TRAEFIK_HTTP_PORT=8080
TRAEFIK_HTTPS_PORT=8443
```

Then access the application at:

- Frontend: http://my.appserver.test:8080
- Traefik Dashboard: http://traefik.appserver.test:8080

#### System PostgreSQL (Port 5432)

**Symptoms**: PostgreSQL containers fail to start or bind errors

**Check if running**:

```bash
sudo systemctl status postgresql
```

**Solution 1 - Stop system PostgreSQL**:

```bash
sudo systemctl stop postgresql
sudo systemctl disable postgresql
```

**Note**: MyAEGEE uses containerized PostgreSQL instances (one per microservice). Your system PostgreSQL is completely separate and won't be affected by MyAEGEE.

**Solution 2 - Change PostgreSQL ports**:

Edit `.env` and add per-service port overrides:

```bash
# Core module PostgreSQL
CORE_POSTGRES_PORT=5433

# Events module PostgreSQL
EVENTS_POSTGRES_PORT=5434

# Add similar overrides for other services as needed
```

#### System Redis (Port 6379)

**Symptoms**: Redis container fails to start

**Check if running**:

```bash
sudo systemctl status redis-server
```

**Solution**:

```bash
sudo systemctl stop redis-server
sudo systemctl disable redis-server
```

#### Portainer (Port 9090)

**Symptoms**: Portainer management UI not accessible

**Check for conflicts** (Prometheus often uses this port):

```bash
sudo lsof -i :9090
```

**Solution - Change Portainer port**:

Edit `.env` and add:

```bash
PORTAINER_PORT=9091
```

Then access Portainer at: http://portainer.appserver.test:9091

### Finding Which Process Uses a Port

Use `lsof` to identify the process:

```bash
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :5432
```

Or use `ss`:

```bash
sudo ss -tulnp | grep :80
```

---

## Docker Issues

### Docker Daemon Not Accessible

**Symptoms**: `Cannot connect to the Docker daemon` error

**Solutions**:

1. **Start Docker daemon**:

```bash
sudo systemctl start docker
sudo systemctl enable docker  # Auto-start on boot
```

2. **Check Docker group membership**:

```bash
groups | grep docker
```

If `docker` is not listed, you need to log out and back in after running the bootstrap script.

3. **Temporary workaround** (current terminal only):

```bash
newgrp docker
```

### Docker Version Too Old

**Symptoms**: Warning during bootstrap about Docker version < 24.0

**Check current version**:

```bash
docker --version
```

**Solution - Upgrade Docker**:

The bootstrap script will offer to upgrade automatically. If you declined, run:

```bash
# Remove old version
sudo apt-get remove -y docker docker-engine docker.io containerd runc

# Re-run bootstrap
./scripts-ubuntu/bootstrap.sh
```

Or install manually following: https://docs.docker.com/engine/install/ubuntu/

### Docker Compose V2 Not Found

**Symptoms**: `docker compose` command not found or using standalone Compose V1

**Check**:

```bash
docker compose version
```

Should show: `Docker Compose version v2.x.x` (NOT `docker-compose version 1.x`)

**Solution**:

Install the Docker Compose plugin:

```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

---

## Permission Issues

### Cannot Access /var/run/docker.sock

**Symptoms**: Permission denied when running Docker commands

**Solution**:

1. Verify you're in the docker group:

```bash
groups
```

2. If not, add yourself:

```bash
sudo usermod -aG docker $USER
```

3. Log out and back in for changes to take effect.

### Cannot Edit /etc/hosts

**Symptoms**: Bootstrap fails to configure hosts file

**Solution**:

The bootstrap script uses `sudo`. Ensure your user has sudo privileges:

```bash
sudo -v
```

If this fails, ask your system administrator to add you to the sudo group:

```bash
sudo usermod -aG sudo $USER
```

---

## Service Startup Issues

### Services Won't Start

**Check Docker daemon**:

```bash
sudo systemctl status docker
```

**Check available disk space** (need at least 10GB free):

```bash
df -h
```

**Check Docker logs**:

```bash
docker ps -a  # See all containers including stopped ones
docker logs <container-name>
```

### Specific Service Fails

**Check service logs**:

```bash
make monitor <service-name>
# Example: make monitor core
```

**Restart specific service**:

```bash
./helper.sh restart <service-name>
# Example: ./helper.sh restart core
```

### Database Connection Errors

**Symptoms**: Services can't connect to PostgreSQL

**Check PostgreSQL containers**:

```bash
docker ps | grep postgres
```

**Restart databases**:

```bash
./helper.sh restart postgres-core
./helper.sh restart postgres-events
# etc.
```

---

## Network Issues

### Cannot Access http://my.appserver.test

**Check /etc/hosts**:

```bash
grep appserver /etc/hosts
```

Should contain:

```
127.0.0.1 my.appserver.test oms-core.appserver.test oms-events.appserver.test ...
```

**If missing, re-run hosts setup**:

```bash
sudo ./scripts-ubuntu/setup-hosts.sh
```

**Check Traefik is running**:

```bash
docker ps | grep traefik
```

**Check Traefik logs**:

```bash
docker logs traefik
```

### DNS Resolution Not Working

**Try alternative**: Use `127.0.0.1` with port directly:

```bash
# Instead of http://my.appserver.test
# Use: http://127.0.0.1:80
```

**Check browser**: Some browsers cache DNS. Try:

- Clearing browser cache
- Using incognito/private mode
- Using `curl` from terminal to test

---

## Performance Issues

### Slow Startup Time

**Normal**: First startup takes 5-10 minutes while building images.

**Speed up subsequent startups**:

- Docker caches built images
- Use `make start` (not `make rebuild`)

**If consistently slow**:

1. **Check available resources**:

```bash
free -h  # Check RAM
df -h    # Check disk
```

2. **Check Docker stats**:

```bash
docker stats
```

3. **Clean up unused Docker resources**:

```bash
make clean  # Stop and remove containers
docker system prune -a  # WARNING: Removes all unused images
```

### Hot Reload Not Working

**Check inotify limits**:

```bash
sysctl fs.inotify.max_user_watches
```

Should be >= 524288. If not:

```bash
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**Restart the service** after changing files:

```bash
make monitor core
# Edit a file
# Watch logs for restart (should happen within 3 seconds)
```

---

## Getting More Help

### Collect Diagnostic Information

Run diagnostics:

```bash
./scripts-ubuntu/bootstrap.sh --validate-only
./scripts-ubuntu/check-port-conflicts.sh
docker ps -a
docker logs traefik
docker system df
```

### Check Logs

**All services**:

```bash
make logs
```

**Specific service**:

```bash
make logs core
make logs events
```

**Live monitoring**:

```bash
make monitor
make monitor core  # Monitor specific service
```

### Common Issues Summary

| Issue                          | Quick Fix                           |
| ------------------------------ | ----------------------------------- |
| Port 80/443 conflict           | `sudo systemctl stop apache2 nginx` |
| Docker permission denied       | Log out and back in                 |
| Can't access \*.appserver.test | Check /etc/hosts, restart Traefik   |
| Services won't start           | `make clean && make start`          |
| Slow hot reload                | Increase inotify limits             |
| Out of disk space              | `docker system prune`               |

### Still Need Help?

1. Check the main README.md for general troubleshooting
2. Search existing GitHub issues: https://github.com/AEGEE/MyAEGEE/issues
3. Create a new issue with:
   - Ubuntu version (`lsb_release -a`)
   - Docker version (`docker --version`)
   - Error messages from logs
   - Steps to reproduce

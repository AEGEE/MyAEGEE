# Quick Reference: MyAEGEE Development

## 🚀 First Time Setup

### Ubuntu 24.04

```bash
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE
make bootstrap-ubuntu
# Log out and back in after first run
make start
```

### Other Systems (Vagrant)

```bash
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE
./start.sh
```

## ⚡ Daily Development Commands

```bash
# Start services
make dev              # Minimal (gateways, frontend, core) - fastest
make start            # As configured in .env
make full             # All services

# Monitor & debug
make status           # Show running services
make logs service=X   # Follow logs (e.g., service=core)
make monitor          # See all logs

# Control services
make restart          # Restart all
make stop             # Stop all

# Rebuild after changes
make rebuild_core     # Rebuild specific service
make build            # Rebuild all
```

## 🔥 Watch Mode (Auto-Reload)

**Already enabled by default!** Just edit and save:

```bash
# Edit any file:
vim core/lib/server.js

# Save → Service auto-restarts in ~2 seconds → Changes live!
```

**What triggers reload:**

- ✅ `.js` files
- ✅ `.json` config files

**What needs rebuild:**

- ❌ `package.json` changes → `make rebuild_core`
- ❌ New dependencies → `make rebuild_core`
- ❌ Dockerfile changes → `make rebuild_core`

## 🎯 Service Selection

Edit `.env` file:

```bash
# 🚀 Minimal (30 seconds startup)
ENABLED_SERVICES=gateways:frontend:core

# 🔧 Development (most common)
ENABLED_SERVICES=gateways:frontend:core:events:statutory:dev-tools

# 🌟 Full (all services, 2-3 minutes)
ENABLED_SERVICES=gateways:frontend:core:events:statutory:network:summeruniversity:discounts:mailer
```

## 🌐 Access URLs

```
Frontend:          http://my.appserver.test
Traefik Dashboard: http://traefik.appserver.test
Portainer:         http://portainer.appserver.test (if dev-tools enabled)
PgAdmin:           http://pgadmin.appserver.test (if dev-tools enabled)

API Core:          http://my.appserver.test/api/core/*
API Events:        http://my.appserver.test/api/events/*
API Statutory:     http://my.appserver.test/api/statutory/*
```

## 📊 Service Dependencies

```
frontend → requires: core, traefik
core → requires: postgres-core, traefik
events → requires: core, postgres-events, traefik
statutory → requires: core, postgres-statutory, traefik
network → requires: core, postgres-network, traefik
summeruniversity → requires: core, postgres-summeruniversity, traefik
discounts → requires: core, postgres-discounts, traefik
```

## 🐛 Troubleshooting

### Services won't start

```bash
# Check logs
make logs service=core

# Check status
make status
docker ps

# Reset everything
make stop
make start
```

### DNS not working

```bash
# Verify /etc/hosts
grep appserver /etc/hosts

# Should show:
# 127.0.0.1 appserver.test my.appserver.test traefik.appserver.test

# Re-run setup if missing (Ubuntu):
sudo ./scripts-ubuntu/setup-hosts.sh
```

### Database issues

```bash
# Recreate database
make stop
docker volume rm myaegee_postgres-core
make start
```

### Watch mode not working

```bash
# Verify volumes are mounted
docker inspect myaegee_core_1 | grep Mounts -A 20

# Should see source code directories mounted
```

## 📚 Default Credentials

All test users have password: `5ecr3t5ecr3t`

- `admin@example.com` - Admin
- `board@example.com` - Board member
- `member@example.com` - Regular member

## 🔗 Architecture

```
Browser
   ↓
Traefik (:80) - Reverse proxy routes all traffic
   ↓
   ├─→ Frontend (Vue.js)
   ├─→ Core (Node.js + PostgreSQL)
   ├─→ Events (Node.js + PostgreSQL)
   ├─→ Statutory (Node.js + PostgreSQL)
   └─→ Other services...
```

**Why Traefik?**

- Single entry point (no CORS issues)
- Path-based routing (`/api/core`, `/api/events`)
- Automatic service discovery
- Production parity

## 💡 Pro Tips

1. **Use `make dev` for quick feature work** - Only starts essentials
2. **Use `make logs service=X` to debug** - Cleaner than full monitor
3. **Edit .env to customize** - Only run services you need
4. **Check `make status`** - See what's actually running
5. **Traefik dashboard shows all routes** - Great for debugging routing

## 📖 More Info

- Full documentation: `README.md`
- Ubuntu setup: `docs/setup-ubuntu-direct.md`
- Troubleshooting: `docs/troubleshooting-ubuntu.md`
- Specification: `specs/002-simplified-docker-setup/specification.md`

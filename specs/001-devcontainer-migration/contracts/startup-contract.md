# Dev Container Startup Contract

**Version**: 1.0.0  
**Date**: 2025-10-18

## Purpose

This contract defines the expected behavior and outputs of the dev container startup process. It serves as a testing specification for validating that the development environment starts correctly.

---

## Startup Sequence Contract

### Phase 1: Container Creation (Post-Create)

**Trigger**: First time container is created (or rebuilt)

**Expected Behavior**:

1. Base dev container image is pulled/built
2. Workspace is mounted at `/workspace`
3. VS Code extensions are installed
4. Post-create script executes successfully

**Post-Create Script Outputs**:

```
✓ Detected platform: [linux|darwin|windows]
✓ Installed Node.js version: [version]
✓ Installed Docker Compose version: [version]
✓ Generated .env.devcontainer configuration
✓ Set up command aliases
→ Container ready for first start
```

**Exit Code**: 0 (success required, non-zero blocks container creation)

**Artifacts Created**:

- `.env.devcontainer` file with localhost URL configuration
- Shell aliases in `/workspace/.devcontainer/aliases.sh`
- Log file: `.devcontainer/logs/post-create.log`

---

### Phase 2: Container Start (Post-Start)

**Trigger**: Every time container starts (including after restart)

**Expected Behavior**:

1. Detect available system resources (RAM, disk)
2. Offer minimal mode if resources constrained
3. Start services in dependency order
4. Wait for health checks to pass
5. Display service access information

**Post-Start Script Outputs**:

```
MyAEGEE Development Environment
================================

🔍 Resource Check:
   Available RAM: [X] GB
   [✓] Sufficient resources for full mode
   [or]
   [⚠️] Limited resources detected. Starting in minimal mode...

📦 Starting Services:
   [1/3] Databases...
         ✓ postgres-core (health check passed)
         ✓ postgres-events (health check passed)
         ✓ postgres-statutory (health check passed)
         ✓ postgres-discounts (health check passed)

   [2/3] Backend Services...
         ✓ core (http://localhost:8084/healthcheck)
         ✓ events (http://localhost:8085/healthcheck)
         ✓ statutory (http://localhost:8086/healthcheck)
         ✓ discounts (http://localhost:8087/healthcheck)

   [3/3] Frontend & Tools...
         ✓ frontend (http://localhost:3000)
         ✓ traefik (http://localhost:8080)
         ✓ portainer (http://localhost:9000)
         ✓ pgadmin (http://localhost:5050)

🚀 Development Environment Ready!

📍 Service Access URLs:
   Application:     http://localhost:3000
   Core API:        http://localhost:8084
   Events API:      http://localhost:8085
   Statutory API:   http://localhost:8086
   Discounts API:   http://localhost:8087

   Admin Tools:
   Traefik:         http://localhost:8080
   Portainer:       http://localhost:9000
   pgAdmin:         http://localhost:5050

💡 Quick Commands:
   make start       - Start all services
   make stop        - Stop all services
   make restart     - Restart all services
   make reset-db    - Reset databases to seed data
   make logs        - View all service logs

📚 Documentation: /workspace/docs/dev-setup-devcontainer.md
```

**Exit Code**: 0 (warning messages allowed, but services must start)

**Timing Constraints**:

- Database health checks: Pass within 30 seconds
- Backend service health checks: Pass within 60 seconds
- Frontend ready: Within 30 seconds after backend ready
- Total startup time: <2 minutes

---

## Health Check Contract

### Database Health Check

**Endpoint**: Internal PostgreSQL check  
**Method**: `pg_isready -U postgres`

**Success Response**:

```
/var/run/postgresql:5432 - accepting connections
```

**Exit Code**: 0 (healthy), non-zero (unhealthy)

**Timing**: Check every 5 seconds, timeout 5 seconds, max 5 retries

---

### Backend Service Health Check

**Endpoint**: `GET /healthcheck`  
**Port**: Service-specific (8084, 8085, 8086, 8087)

**Success Response**:

```json
{
  "success": true
}
```

**Status Code**: 200 (healthy), 4xx/5xx or timeout (unhealthy)

**Timing**: Check every 10 seconds, timeout 5 seconds, max 5 retries

---

### Frontend Health Check

**Endpoint**: `GET http://localhost:3000`  
**Method**: HTTP request to root path

**Success Response**: HTTP 200 with HTML content

**Status Code**: 200 (healthy), 4xx/5xx or timeout (unhealthy)

**Timing**: Check every 10 seconds, timeout 5 seconds, max 5 retries

---

## Error Handling Contract

### Port Conflict Error

**Condition**: Host port already in use

**Error Message**:

```
❌ Port Conflict Detected!

Service [service-name] cannot bind to port [port].
Port [port] is already in use on the host machine.

Solutions:
1. Stop the process using port [port]:
   lsof -ti:[port] | xargs kill -9

2. Change the port mapping in .devcontainer/docker-compose.devcontainer.yml

3. Use a different port by setting environment variable:
   export [SERVICE]_PORT=[new-port]
```

**Exit Code**: 1 (startup aborted)

---

### Insufficient Resources Error

**Condition**: Available RAM < 4GB

**Error Message**:

```
❌ Insufficient Resources

Available RAM: [X] GB
Required: At least 4GB available for minimal mode

Recommendations:
1. Close other applications to free memory
2. Increase Docker Desktop memory allocation:
   Docker Desktop → Settings → Resources → Memory

3. If you have already allocated sufficient memory in Docker Desktop,
   restart Docker Desktop and try again.
```

**Exit Code**: 1 (startup aborted, requires user action)

---

### Health Check Failure Error

**Condition**: Service fails health check after max retries

**Error Message**:

```
❌ Service Health Check Failed

Service: [service-name]
Health check: [command]
Attempts: [5/5]
Last error: [error message]

Troubleshooting:
1. Check service logs:
   docker logs myaegee_[service]_1

2. Verify dependencies are running:
   docker ps | grep [dependency]

3. Try restarting the service:
   make restart

4. For database issues, try resetting:
   make reset-db

📚 See troubleshooting guide: docs/dev-setup-devcontainer.md#troubleshooting
```

**Exit Code**: 1 (partial startup, affected service stopped)

---

## Minimal Mode Contract

### Trigger Condition

Available RAM < 6GB (but >= 4GB)

### Services Started (Minimal Mode)

- ✅ Frontend (port 3000)
- ✅ Core API (port 8084)
- ✅ postgres-core (internal)
- ❌ Events API (disabled)
- ❌ Statutory API (disabled)
- ❌ Discounts API (disabled)
- ❌ Portainer (disabled)
- ❌ pgAdmin (disabled)
- ❌ Traefik (disabled)

### User Prompt

```
⚠️ Resource Constraint Detected

Available RAM: [X] GB
Full mode requires: 6GB

Start in minimal mode? (Y/n)
Minimal mode includes: Frontend, Core API, and database
Excluded: Events, Statutory, Discounts, admin tools

[Y]: Start in minimal mode
[n]: Abort and free up resources
```

**Default**: Y (if no input after 10 seconds)

---

## Testing Checklist

To verify compliance with this contract:

- [ ] Post-create script exits with code 0
- [ ] .env.devcontainer file is generated with correct URLs
- [ ] Post-start script completes in <2 minutes
- [ ] All database health checks pass
- [ ] All backend service health checks pass
- [ ] Frontend responds to HTTP requests
- [ ] Service URLs in startup message are accessible
- [ ] Port conflict is detected and reported clearly
- [ ] Insufficient resources error shows when RAM <4GB
- [ ] Minimal mode prompt appears when RAM <6GB (>=4GB)
- [ ] Services start in correct dependency order
- [ ] Error messages include actionable troubleshooting steps

---

## Version History

| Version | Date       | Changes                     |
| ------- | ---------- | --------------------------- |
| 1.0.0   | 2025-10-18 | Initial contract definition |

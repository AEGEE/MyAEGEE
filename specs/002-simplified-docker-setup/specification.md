# Specification: Simplified Docker Setup with Watch Mode

**Feature ID**: 002-simplified-docker-setup  
**Status**: Draft  
**Created**: 2025-10-18  
**Related**: 001-direct-docker-ubuntu

## 1. Overview

Simplify the MyAEGEE Docker development setup by:

1. Evaluating removal of Traefik reverse proxy
2. Ensuring all Node.js services run in watch mode for live reloading
3. Maintaining single-script launch capability

## 2. Current Architecture Analysis

### 2.1 Current Services

**Core Infrastructure:**

- Traefik (reverse proxy on ports 80/443)
- Multiple PostgreSQL containers (one per service)
- Docker network "OMS"

**Node.js Services (running on port 8084 internally):**

- core
- events
- statutory
- discounts
- network
- summeruniversity
- knowledge (optional)

**Other Services:**

- frontend (Vue.js, port 80 internally)
- mailer (Elixir/Phoenix, port 4000)
- gsuite-wrapper (Node.js)

**Static File Servers (nginx):**

- core-static (serves uploaded media)
- events-static
- statutory-static
- summeruniversity-static

### 2.2 Current Watch Mode Status

✅ **Already configured with watch mode:**

```yaml
# Example from current-config.yml
core:
  command: sh -c "sh /usr/app/scripts/bootstrap.sh && nodemon -L -e 'js,json' lib/run.js | bunyan"

network:
  command: sh -c '/usr/app/scripts/bootstrap.sh && npm run nodemon-start | bunyan'
```

All Node.js services already use `nodemon` for auto-reload on file changes:

- `-L` flag enables legacy watch (for Docker volumes)
- `-e 'js,json'` watches JavaScript and JSON files
- Changes in mounted volumes trigger automatic restart

### 2.3 Traefik's Role

**Current functionality:**

1. **Reverse proxy routing** - Single entry point (port 80)
2. **Path-based routing** - Routes `/api/core`, `/api/events`, etc. to respective services
3. **Host-based routing** - Routes `my.appserver.test`, `traefik.appserver.test`, etc.
4. **Path prefix stripping** - Removes `/api/core` before forwarding to service
5. **Static file routing** - Routes `/media/core`, `/media/events` to nginx containers
6. **Service discovery** - Auto-discovers services via Docker labels
7. **Metrics endpoint** - Provides Prometheus metrics
8. **Authentication** - Basic auth for metrics endpoints

**Traefik labels example:**

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.backend=core"
  - "traefik.port=8084"
  - "traefik.new.frontend.rule=PathPrefixStrip:/api/core;"
  - "traefik.new.frontend.priority=110"
```

## 3. Option Analysis: Remove Traefik?

### 3.1 Option A: Remove Traefik (Not Recommended)

**Pros:**

- One less container to manage
- Simpler architecture for development
- Direct port access to services

**Cons:**

- ❌ **Breaking change**: Frontend expects unified API at `my.appserver.test/api/*`
- ❌ **Port collision**: All Node services use port 8084 internally
- ❌ **Path rewriting needed**: Services expect requests without `/api/core` prefix
- ❌ **Static files**: Would need separate solution for media serving
- ❌ **CORS complexity**: Frontend would need CORS config for multiple origins
- ❌ **URL management**: Would need to map 10+ different ports
- ❌ **Production parity**: Production uses Traefik, dev should match

**Implementation complexity:**
Would require:

1. Publishing unique ports for each service (8084, 8085, 8086, etc.)
2. Reconfiguring frontend to call multiple endpoints
3. Setting up CORS for each service
4. Separate solution for static file serving
5. Updating all documentation
6. Maintaining two different configurations (dev vs prod)

### 3.2 Option B: Keep Traefik (Recommended) ✅

**Pros:**

- ✅ **Zero breaking changes**: Everything works as-is
- ✅ **Production parity**: Dev matches production architecture
- ✅ **Unified access**: Single domain with path routing
- ✅ **Automatic discovery**: Services auto-register via Docker labels
- ✅ **Already lightweight**: Traefik is ~50MB image, minimal overhead

**Cons:**

- One additional container (acceptable trade-off)

**Recommendation**: **Keep Traefik**

Traefik is the right tool for this job. It provides essential routing and service discovery with minimal overhead. Removing it would:

- Add significant complexity to the codebase
- Break production parity
- Require extensive reconfiguration
- Provide minimal benefit (saves ~50MB RAM)

## 4. Proposed Solution: Keep Traefik + Ensure Watch Mode

### 4.1 Architecture

```
┌─────────────────────────────────────────────────┐
│  Developer Machine (Ubuntu 24.04)               │
│                                                  │
│  Browser → http://my.appserver.test             │
│              ↓                                   │
│         Traefik (:80)                            │
│              ↓                                   │
│    ┌─────────┴──────────────────┐               │
│    │                             │               │
│  Frontend     Node.js Services   │               │
│  (Vue.js)     (with nodemon)     │               │
│    ↓              ↓               │               │
│    └──────────────┴───────────┐  │               │
│                   PostgreSQL   │  │               │
│                   Containers   │  │               │
└─────────────────────────────────────────────────┘
```

### 4.2 Service Inventory

**Keep:**

- ✅ Traefik (reverse proxy)
- ✅ PostgreSQL containers (core, events, statutory, network, summeruniversity, discounts)
- ✅ Node.js services (core, events, statutory, network, summeruniversity, discounts)
- ✅ Frontend (Vue.js with hot reload)
- ✅ Mailer (Elixir)
- ✅ Static nginx containers (for media serving)

**Optional (can be disabled via .env):**

- knowledge service
- gsuite-wrapper
- dev-tools (portainer, pgadmin, swagger)
- monitor services (grafana, prometheus)

### 4.3 Watch Mode Configuration

All Node.js services should use nodemon with proper configuration:

**Standard command pattern:**

```yaml
command: sh -c "sh /usr/app/scripts/bootstrap.sh && nodemon -L -e 'js,json' lib/run.js | bunyan"
```

**Nodemon options:**

- `-L` or `--legacy-watch` - Use polling for Docker volumes (required)
- `-e 'js,json'` - Watch JavaScript and JSON files
- `| bunyan` - Pretty-print logs

**Volume mounts for hot reload:**

```yaml
volumes:
  - ./core/lib:/usr/app/src/lib:rw
  - ./core/models:/usr/app/src/models:rw
  - ./core/middlewares:/usr/app/src/middlewares:rw
  - ./core/config:/usr/app/src/config:rw
```

## 5. Simplified Configuration

### 5.1 Minimal Service Set

For basic development, minimum required services:

```bash
# In .env
ENABLED_SERVICES=gateways:frontend:core:events:statutory
```

This starts:

- Traefik (gateway)
- Frontend (Vue.js)
- Core service + postgres-core
- Events service + postgres-events
- Statutory service + postgres-statutory

### 5.2 Single Script Launch

Already implemented in `scripts-ubuntu/bootstrap.sh`:

```bash
# Full setup (run once)
make bootstrap-ubuntu

# Or step by step:
scripts-ubuntu/bootstrap.sh      # Install Docker, setup environment
make start                        # Start all enabled services
```

After initial setup, daily development:

```bash
make start    # Start all services
make stop     # Stop all services
make restart  # Restart all services
```

### 5.3 Service Access

With Traefik (current setup):

```
Frontend:          http://my.appserver.test
Traefik Dashboard: http://traefik.appserver.test
API Core:          http://my.appserver.test/api/core/*
API Events:        http://my.appserver.test/api/events/*
```

## 6. Implementation Plan

### 6.1 Phase 1: Verify Watch Mode (Already Done) ✅

**Status**: Complete  
**Evidence**: All services in `current-config.yml` use nodemon

No action needed - watch mode is already configured.

### 6.2 Phase 2: Document Current Setup

**Tasks:**

1. Update README with simplified explanation
2. Document that watch mode is enabled by default
3. Explain Traefik's role clearly
4. Provide examples of editing files and seeing changes

**File**: `README.md`

### 6.3 Phase 3: Optimize Service Selection

**Tasks:**

1. Review default `ENABLED_SERVICES` in `.env`
2. Document minimal vs full service sets
3. Provide examples for different dev scenarios

**Example scenarios:**

```bash
# Frontend development only
ENABLED_SERVICES=gateways:frontend:core

# Core service development
ENABLED_SERVICES=gateways:frontend:core:events

# Full stack
ENABLED_SERVICES=gateways:frontend:core:events:statutory:network:summeruniversity:discounts:mailer
```

### 6.4 Phase 4: Improve Developer Experience

**Enhancements:**

1. Add `make dev` command that starts minimal services
2. Add `make full` command for all services
3. Improve startup feedback (show URLs, ready status)
4. Add `make logs service=core` for following specific service logs

**New Makefile targets:**

```makefile
dev: # Start minimal development services
	@echo "Starting minimal development environment..."
	ENABLED_SERVICES=gateways:frontend:core ./helper.sh --start

full: # Start all services
	@echo "Starting full environment..."
	ENABLED_SERVICES=gateways:frontend:core:events:statutory:network:summeruniversity:discounts:mailer ./helper.sh --start

logs: # Follow logs for a specific service
	@docker-compose logs -f $(service)
```

## 7. Trade-offs & Decisions

### 7.1 Decision: Keep Traefik ✅

**Rationale:**

- Essential for development/production parity
- Minimal overhead (~50MB RAM, ~10MB disk)
- Provides critical functionality (routing, path rewriting, service discovery)
- Removing it creates more problems than it solves

### 7.2 Decision: Watch Mode Already Configured ✅

**Status**: No changes needed  
**Evidence**: All Node services use nodemon with proper flags

### 7.3 Decision: Single Script Launch ✅

**Status**: Already implemented  
**Command**: `make bootstrap-ubuntu` (initial) or `make start` (daily)

## 8. Validation Criteria

### 8.1 Functional Requirements

- ✅ All services start with single command: `make start`
- ✅ Node.js services reload on file changes (nodemon)
- ✅ Frontend accessible at `http://my.appserver.test`
- ✅ APIs accessible via Traefik routing
- ✅ Static media files served correctly
- ✅ Developer can edit code and see changes without restart

### 8.2 Performance Requirements

- Services start within 2 minutes
- File changes trigger reload within 2 seconds
- Memory usage < 4GB for minimal setup
- Memory usage < 8GB for full setup

### 8.3 Developer Experience

- Clear documentation of which services are running
- Easy to start/stop individual services
- Logs are accessible and readable
- Error messages are helpful

## 9. Migration Path

### 9.1 No Migration Needed

Current setup already meets all requirements:

- ✅ Single script launch
- ✅ Watch mode enabled
- ✅ Traefik configured

### 9.2 Documentation Updates Only

Only need to:

1. Document existing functionality
2. Clarify that watch mode is default
3. Explain Traefik's role
4. Provide service selection examples

## 10. Conclusion

### 10.1 Summary

The current setup is already close to optimal:

- **Watch mode**: Already configured with nodemon
- **Single script**: `make start` already works
- **Traefik**: Should be kept for essential routing

### 10.2 Recommendations

1. **Keep current architecture** - Don't remove Traefik
2. **Improve documentation** - Clarify existing functionality
3. **Add convenience commands** - Make service selection easier
4. **Optimize defaults** - Suggest minimal service set for faster startup

### 10.3 Next Steps

1. ✅ Create this specification
2. → Update README.md with clear examples
3. → Add convenience Makefile targets
4. → Document service selection patterns
5. → Test minimal vs full configurations

## Appendix A: Service Dependencies

```
Frontend requires:
  - Traefik (for routing)
  - Core (for authentication)

Core requires:
  - postgres-core
  - Traefik

Events requires:
  - postgres-events
  - Core (for authentication)
  - Traefik

Statutory requires:
  - postgres-statutory
  - Core (for authentication)
  - Traefik

All services require:
  - Docker network "OMS"
  - Shared volumes
```

## Appendix B: Port Mapping

```
External (host) ports:
  80    → Traefik
  443   → Traefik (SSL, production)

Internal (container) ports:
  8084  → All Node.js services (routed via Traefik)
  4000  → Mailer (Elixir)
  80    → Frontend nginx
  80    → Static file nginx containers
  5432  → PostgreSQL containers (not exposed)
  8080  → Traefik dashboard
```

## Appendix C: Current Watch Mode Evidence

From `current-config.yml`:

```yaml
core:
  command: sh -c "sh /usr/app/scripts/bootstrap.sh && nodemon -L -e 'js,json' lib/run.js | bunyan"

events:
  command: sh -c "sh /usr/app/scripts/bootstrap.sh && nodemon -L -e 'js,json' lib/run.js | bunyan"

statutory:
  command: sh -c "sh /usr/app/scripts/bootstrap.sh && nodemon -L -e 'js,json' lib/run.js | bunyan"

summeruniversity:
  command: sh -c "sh /usr/app/scripts/bootstrap.sh && nodemon -L -e 'js,json' lib/run.js | bunyan"

discounts:
  command: sh -c '/usr/app/scripts/bootstrap.sh && npm run nodemon-start | bunyan'

network:
  command: sh -c '/usr/app/scripts/bootstrap.sh && npm run nodemon-start | bunyan'
```

All services already use nodemon with legacy watch mode enabled.

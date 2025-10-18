# Data Model: Dev Container Migration

**Date**: 2025-10-18  
**Feature**: 001-devcontainer-migration

## Overview

This feature is primarily infrastructure-focused and doesn't introduce new application data models. However, it does involve configuration data structures that define the development environment.

---

## Configuration Entities

### DevContainer Configuration

Represents the VS Code dev container configuration.

**Location**: `.devcontainer/devcontainer.json`

**Attributes**:

- `name`: String - Display name of the dev container
- `dockerComposeFile`: Array<String> - Paths to docker-compose files
- `service`: String - Which service to use as the workspace container
- `workspaceFolder`: String - Path inside container for workspace
- `forwardPorts`: Array<Number> - Ports to automatically forward
- `postCreateCommand`: String - Command to run after container creation
- `postStartCommand`: String - Command to run on container start
- `customizations.vscode.extensions`: Array<String> - VS Code extensions to install
- `customizations.vscode.settings`: Object - VS Code settings to apply
- `mounts`: Array<String> - Additional volume mounts

**Validation Rules**:

- Must reference valid docker-compose files
- Service name must exist in referenced compose files
- Ports must be in valid range (1-65535)
- Commands must be valid shell scripts

**Relationships**:

- References → Docker Compose services
- Configures → VS Code workspace environment

---

### Service Configuration

Represents each microservice's container configuration.

**Location**: `.devcontainer/docker-compose.devcontainer.yml` (extends `base-docker-compose.yml`)

**Attributes**:

- `image`: String - Docker image name and tag
- `build`: Object - Build configuration if building from Dockerfile
- `ports`: Array<String> - Port mappings (host:container)
- `depends_on`: Object - Service dependencies with health check conditions
- `healthcheck`: Object - Health check configuration
- `environment`: Object - Environment variables
- `volumes`: Array<String> - Volume mounts
- `networks`: Array<String> - Network attachments

**Validation Rules**:

- Health check test command must be valid
- Port mappings must not conflict
- Dependent services must exist
- Volume names must be valid

**State Transitions**:

1. **Created** → Container created but not started
2. **Starting** → Container starting, dependencies being checked
3. **Healthy** → Health check passing, service ready
4. **Unhealthy** → Health check failing
5. **Stopped** → Container stopped

**Relationships**:

- Depends on → Other services (databases, APIs)
- Mounts → Docker volumes
- Exposes → Ports

---

### Environment Configuration

Represents environment variables for service configuration.

**Location**: `.env.devcontainer` (auto-generated)

**Attributes**:

- `BASE_URL`: String - Base URL for services (localhost)
- `SUBDOMAIN_*`: String - Service-specific URLs
- `ENABLED_SERVICES`: String - Colon-separated list of enabled services
- `MYAEGEE_ENV`: String - Environment mode (development/production)
- `*_PORT`: Number - Port assignment for each service
- Database credentials (inherited from secrets/)

**Validation Rules**:

- URLs must be valid format
- Ports must be unique and available
- Service names must match enabled services
- Environment must be valid value

**Relationships**:

- Used by → All service containers
- Overrides → Default .env values

---

### Volume Configuration

Represents persistent storage for databases.

**Location**: Docker named volumes (managed by Docker Engine)

**Attributes**:

- `name`: String - Volume name (e.g., `myaegee-core-db`)
- `driver`: String - Volume driver (usually `local`)
- `mountpoint`: String - Host path where volume is stored
- `labels`: Object - Metadata labels

**Lifecycle**:

1. **Created** - Volume created on first container start
2. **Mounted** - Attached to running container
3. **Unmounted** - Detached when container stops
4. **Deleted** - Removed explicitly with `docker volume rm`

**Validation Rules**:

- Name must be unique
- Must be mounted to valid container path
- Permissions must allow database process to write

**Relationships**:

- Mounted by → PostgreSQL containers
- Persists → Database files

---

## Configuration Schemas

### devcontainer.json Schema

```json
{
  "name": "MyAEGEE Dev",
  "dockerComposeFile": [
    "../base-docker-compose.yml",
    "docker-compose.devcontainer.yml"
  ],
  "service": "workspace",
  "workspaceFolder": "/workspace",
  "forwardPorts": [3000, 8080, 8084, 8085, 8086, 8087, 8088, 9000, 5050],
  "postCreateCommand": "bash .devcontainer/scripts/post-create.sh",
  "postStartCommand": "bash .devcontainer/scripts/post-start.sh",
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "editorconfig.editorconfig",
        "ms-azuretools.vscode-docker"
      ],
      "settings": {
        "terminal.integrated.defaultProfile.linux": "bash"
      }
    }
  }
}
```

### docker-compose.devcontainer.yml Schema

```yaml
version: "3.4"

services:
  workspace:
    image: mcr.microsoft.com/devcontainers/base:ubuntu-22.04
    volumes:
      - ..:/workspace:cached
    command: sleep infinity
    network_mode: service:frontend
    depends_on:
      - frontend
      - core
      - postgres-core

  # Service overrides for port mappings
  frontend:
    ports:
      - "3000:80"
    depends_on:
      core:
        condition: service_healthy

  core:
    ports:
      - "8084:8084"
    depends_on:
      postgres-core:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8084/healthcheck"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgres-core:
    volumes:
      - myaegee-core-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  myaegee-core-db:
  myaegee-events-db:
  myaegee-statutory-db:
  myaegee-discounts-db:

networks:
  default:
    external: false
    name: myaegee-dev
```

---

## State Management

### Service Startup State Machine

```
                    ┌──────────┐
                    │  INIT    │
                    └────┬─────┘
                         │
                         ├─── Check available RAM
                         │    ├─ <6GB available → Offer minimal mode
                         │    └─ >=6GB available → Full mode
                         │
                    ┌────▼─────────┐
                    │  STARTING    │
                    │  DEPS        │
                    └────┬─────────┘
                         │
                         ├─── Start databases first
                         │    └─ Wait for health checks
                         │
                    ┌────▼─────────┐
                    │  STARTING    │
                    │  SERVICES    │
                    └────┬─────────┘
                         │
                         ├─── Start backend services
                         │    └─ Wait for health checks
                         │
                    ┌────▼─────────┐
                    │  STARTING    │
                    │  FRONTEND    │
                    └────┬─────────┘
                         │
                         ├─── Start frontend & admin tools
                         │    └─ Wait for health checks
                         │
                    ┌────▼─────────┐
                    │   HEALTHY    │
                    │   (READY)    │
                    └──────────────┘
```

### Error States

- **DEPENDENCY_FAILED**: Required service health check failed
- **PORT_CONFLICT**: Port already in use on host
- **OUT_OF_MEMORY**: Insufficient RAM to start services
- **BUILD_FAILED**: Container image build failed
- **NETWORK_ERROR**: Docker network creation failed

---

## Validation Rules Summary

### Port Assignments

- Frontend: 3000
- Traefik: 8080
- Core API: 8084
- Events API: 8085
- Statutory API: 8086
- Discounts API: 8087
- Knowledge API: 8088
- Portainer: 9000
- pgAdmin: 5050
- PostgreSQL: 5432 (internal only)

### Resource Constraints

- Full mode: Requires 6GB+ available RAM
- Minimal mode: Requires 4GB+ available RAM
- Disk space: 20GB+ free space
- Build time: <15 minutes
- Startup time: <2 minutes after build

### Health Check Requirements

- All databases: `pg_isready` check
- All APIs: HTTP GET to `/healthcheck` endpoint
- Check interval: 10 seconds
- Timeout: 5 seconds
- Max retries: 5 (50 seconds total wait)

---

## Non-Application Data

This feature doesn't introduce any application-level data models (no database tables, no API resources). All data is configuration and infrastructure state managed by Docker and VS Code.

**Key Takeaway**: The "data model" here is the configuration structure that defines how the development environment is set up and managed, not application business data.

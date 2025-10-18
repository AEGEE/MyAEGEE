# Feature Specification: Dev Container Migration

**Feature Branch**: `001-devcontainer-migration`  
**Created**: October 18, 2025  
**Status**: Draft  
**Input**: User description: "Running with vagrant is too much overhead. I want to use devcontainers and GitHub Codespaces instead for local development"

## Clarifications

### Session 2025-10-18

- Q: How should developers access different services (frontend, traefik dashboard, portainer, pgadmin, etc.) in the new dev container setup, given that Vagrant uses subdomain-based URLs like `my.appserver.test` but Codespaces doesn't support subdomains? → A: Local dev containers use `localhost` with ports; Codespaces uses GitHub's port forwarding URLs (e.g., `https://username-repo-3000.githubpreview.dev`) - documentation explains both
- Q: How should the system handle service startup failures or dependencies not being ready (e.g., backend services need databases ready first)? → A: Services use health checks and retry logic; wait for dependencies before starting dependent services
- Q: What port numbers should be used for each service in the dev container environment to avoid conflicts with standard system ports? → A: Frontend: 3000, Traefik: 8080, Portainer: 9000, pgAdmin: 5050, APIs: 8084+
- Q: Should the system support custom or minimal seed data configurations for developers working on specific features? → A: Default seed data on first run; developers can configure minimal/custom seeds via environment variable or flag
- Q: How should the system behave on machines with limited resources (e.g., 8GB RAM total) when it might exceed the 4GB target? → A: Detect available RAM and provide minimal service mode (only essential services) for constrained machines with warnings

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Local Development Setup (Priority: P1)

A developer wants to set up the MyAEGEE development environment on their local machine without installing VirtualBox, Vagrant, or manually configuring Docker. They want a one-click experience that works across different operating systems (Windows, macOS, Linux).

**Why this priority**: This is the core value proposition - reducing setup overhead and complexity for new and existing developers. Without this working, the feature provides no value.

**Independent Test**: Can be fully tested by cloning the repository and opening it in VS Code with Dev Containers extension installed. The environment should build and all services should start automatically. Success means a developer can access services via localhost with specific ports (`http://localhost:3000` for frontend, `http://localhost:8080` for traefik, `http://localhost:9000` for portainer, `http://localhost:5050` for pgadmin) without any manual configuration steps.

**Acceptance Scenarios**:

1. **Given** a developer has VS Code with Dev Containers extension installed, **When** they clone the repository and open it in VS Code, **Then** they are prompted to "Reopen in Container" and can start development after accepting
2. **Given** the dev container is building, **When** the build completes, **Then** all required services (core, events, frontend, databases, etc.) are running, healthy, and accessible with dependencies started in correct order
3. **Given** the dev container is running, **When** the developer opens a terminal, **Then** they have access to all necessary CLI tools (Node.js, npm, docker-compose, etc.)
4. **Given** the dev container is running, **When** the developer edits a file in the workspace, **Then** changes are reflected in the running application with hot-reload working
5. **Given** a developer without Docker Desktop, **When** they attempt to use the dev container, **Then** they receive clear instructions about Docker installation requirements

---

### User Story 2 - GitHub Codespaces Development (Priority: P2)

A developer wants to contribute to MyAEGEE without any local setup, using GitHub Codespaces to get a fully configured cloud-based development environment with a single click from the repository page.

**Why this priority**: This enables zero-barrier contribution for new developers and allows development from any device with a browser. It's secondary to local development but provides significant value for accessibility and onboarding.

**Independent Test**: Can be fully tested by creating a Codespace from the repository's GitHub page. Success means the Codespace builds, all services start, and the developer can access services through GitHub's port forwarding URLs (automatically generated like `https://username-repo-3000.githubpreview.dev`) within 10 minutes.

**Acceptance Scenarios**:

1. **Given** a user with GitHub account access to the repository, **When** they click "Code > Codespaces > Create codespace on [branch]", **Then** a new Codespace is created and begins building
2. **Given** a Codespace is building, **When** the build completes, **Then** all services are running, healthy with dependencies resolved, and accessible via port forwarding
3. **Given** services are running in Codespace, **When** the developer opens forwarded ports, **Then** they can access the frontend, API endpoints, and admin tools in their browser
4. **Given** a Codespace is active, **When** the developer makes code changes, **Then** hot-reload works and changes are visible in the preview
5. **Given** a developer stops their Codespace, **When** they restart it later, **Then** their work and database state are preserved (within Codespace retention limits)

---

### User Story 3 - Database and State Management (Priority: P3)

Developers need their database changes and test data to persist between container restarts during active development sessions, and they need an easy way to reset to a clean state when needed.

**Why this priority**: While important for productivity, database persistence is a convenience feature that doesn't block the core functionality. Developers can work around this by re-seeding data, making it lower priority than the basic setup.

**Independent Test**: Can be fully tested by creating test data in the running dev container, stopping the container, restarting it, and verifying the data still exists. Also test a reset command that wipes data and returns to the initial seeded state.

**Acceptance Scenarios**:

1. **Given** a developer has created test users and data, **When** they stop and restart the dev container, **Then** their test data is still present
2. **Given** a developer wants to start fresh, **When** they run a reset command, **Then** all databases are dropped and recreated with seed data (default or custom based on configuration)
3. **Given** multiple databases are used (core, events, statutory, discounts), **When** the container starts, **Then** all database volumes are mounted and data persists independently
4. **Given** a developer corrupts their database, **When** they delete the volume and restart, **Then** the database is recreated with seed data automatically

---

### User Story 4 - Service Configuration and Customization (Priority: P3)

Developers want to enable or disable specific microservices (core, events, statutory, discounts, etc.) based on what they're working on, without modifying the core configuration files.

**Why this priority**: This is an optimization for experienced developers who know which services they need. New developers should have all services running by default, making this a lower priority enhancement.

**Independent Test**: Can be fully tested by setting environment variables or command flags to disable specific services, then verifying only enabled services are running and the application functions correctly without the disabled services.

**Acceptance Scenarios**:

1. **Given** a developer only needs to work on the frontend and core service or has limited RAM, **When** they configure the dev container to disable events/statutory/discounts or minimal mode is auto-detected, **Then** only the specified services start and the application functions
2. **Given** a developer has disabled a service, **When** they attempt to access features requiring that service, **Then** they see clear messages indicating the service is disabled
3. **Given** default configuration, **When** a developer opens the dev container, **Then** all services are enabled by default for full functionality
4. **Given** a developer wants to re-enable a disabled service, **When** they update the configuration and rebuild, **Then** the service starts and integrates with the existing environment

---

### Edge Cases

- What happens when a developer has port conflicts on their host machine (3000, 8080, 9000, 5050, or 5432 already in use)?
- How does the system handle developers switching between Vagrant and Dev Container setups on the same machine?
- What happens when Docker Desktop is not running or crashes during dev container operation?
- How does the system handle network connectivity issues during initial dev container build (dependency download failures)?
- What happens if a developer's machine runs out of disk space during the build process?
- How does the system handle multiple simultaneous Codespaces or dev containers for different branches?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a dev container configuration that builds successfully on VS Code with Dev Containers extension
- **FR-002**: System MUST automatically start all enabled microservices (core, events, statutory, discounts, summeruniversity, network, knowledge, mailer, gsuite-wrapper, frontend, gateways) when the dev container starts, with health checks and dependency ordering (databases before backend services, backend services before frontend)
- **FR-003**: System MUST expose all necessary ports for accessing services (frontend, APIs, admin tools, databases) via localhost with specific ports in local dev containers, and via GitHub's automatic port forwarding in Codespaces
- **FR-004**: System MUST work on Windows, macOS, and Linux host machines with Docker installed
- **FR-005**: System MUST support GitHub Codespaces with the same configuration as local dev containers
- **FR-006**: System MUST preserve database data between container restarts using Docker volumes
- **FR-007**: System MUST provide pre-installed CLI tools (Node.js, npm, docker-compose, git) in the dev container
- **FR-008**: System MUST automatically seed databases with default test users and data on first run, with support for configuring minimal or custom seed profiles via environment variables
- **FR-009**: System MUST support hot-reload for frontend and backend services when code changes are made
- **FR-010**: System MUST provide clear error messages when Docker is not available or improperly configured
- **FR-019**: System MUST detect available host RAM on startup and warn developers if resources are constrained (less than 6GB available), offering to start in minimal service mode automatically
- **FR-017**: System MUST retry service connections with exponential backoff when dependencies are not immediately available, with clear status messages indicating what is being waited for
- **FR-011**: System MUST complete initial build and startup in under 15 minutes on standard hardware with good internet connection
- **FR-012**: System MUST provide a command to reset all databases to initial seeded state (respecting configured seed profile: default, minimal, or custom)
- **FR-013**: Documentation MUST guide developers to install required prerequisites (VS Code, Dev Containers extension, Docker) and explain how to access services via localhost ports (local) or port forwarding URLs (Codespaces)
- **FR-014**: System MUST maintain backward compatibility by keeping Vagrant setup functional alongside dev container setup
- **FR-015**: System MUST configure environment variables automatically (database connections, service URLs using localhost ports, API keys) without manual developer input
- **FR-016**: System MUST provide a service access reference visible to developers on container startup, listing: Frontend (3000), Traefik (8080), Portainer (9000), pgAdmin (5050), and all backend APIs (Core: 8084, Events: 8085, Statutory: 8086, Discounts: 8087, Knowledge: 8088, Summeruniversity: 8089, Network: 8090, Mailer: 8091, GSuite Wrapper: 8092)
- **FR-018**: System MUST use non-privileged ports (above 1024) to avoid requiring root access and prevent conflicts with system services
- **FR-020**: System MUST support a minimal service mode that starts only essential services (frontend, core, and one database) for resource-constrained environments

### Key Entities

- **Dev Container Configuration**: Defines the container image, installed tools, extensions, port mappings, and startup commands
- **Service Orchestration**: Manages startup order and dependencies between microservices (frontend depends on backend APIs, APIs depend on databases)
- **Database Volumes**: Persistent storage for PostgreSQL databases (core, events, statutory, discounts)
- **Environment Configuration**: Service URLs, database credentials, API endpoints, and feature flags
- **Workspace Files**: Mounted source code from host/Codespace that enables live editing and hot-reload

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Developers can set up a working development environment in under 5 minutes after opening the repository (excluding initial image build time)
- **SC-002**: Initial dev container build completes in under 15 minutes on standard hardware with 50 Mbps internet connection
- **SC-003**: 95% of new developers successfully start the dev container on their first attempt without encountering blocking errors
- **SC-004**: All services respond to health checks within 2 minutes of container startup completion, with dependencies starting in correct order automatically
- **SC-005**: Code changes trigger hot-reload and are visible in the browser within 3 seconds
- **SC-006**: Database data persists through 100% of normal container stop/start cycles
- **SC-007**: Codespace creation and full environment startup completes in under 10 minutes
- **SC-008**: Documentation receives positive feedback from at least 80% of developers using it for first-time setup
- **SC-009**: Memory usage of dev container is under 4GB RAM for all services in full mode, and under 2GB RAM in minimal service mode
- **SC-010**: Setup process requires zero manual configuration steps beyond installing VS Code and Docker

## Assumptions

1. Developers have at least 8GB RAM (6GB+ available for containers in full mode, 4GB+ for minimal mode) and 20GB free disk space on their machines
2. Developers using Codespaces have sufficient GitHub quota/minutes for their usage patterns
3. The current Docker-based architecture will remain fundamentally unchanged (we're changing how Docker is run, not replacing Docker)
4. All microservices already support running in containerized environments
5. Standard Docker networking and volume mounting will work without custom host configuration
6. VS Code is acceptable as the primary IDE (though dev container can work with other IDEs, documentation will focus on VS Code)
7. Developers have stable internet connections for initial setup (can work offline after initial build)
8. The existing `.env` file configuration approach will be maintained for service configuration
9. Development ports (3000, 8080, 9000, 5050, 5432, 8084+) are available on host machines or developers understand how to remap ports in case of conflicts
10. Docker Desktop licensing is acceptable for developers' use cases (or they use Docker Engine alternatives)

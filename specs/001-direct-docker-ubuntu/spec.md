# Feature Specification: Direct Docker Development on Ubuntu

**Feature Branch**: `001-direct-docker-ubuntu`  
**Created**: 2025-10-18  
**Status**: Draft  
**Input**: User description: "Vagrant increases the overhead needed to run local development. I want to make that process easier. Focus on running on Ubuntu (24.04) machines, MacOS and Windows are for future improvements"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Quick Bootstrap on Ubuntu (Priority: P1)

A developer with Ubuntu 24.04 wants to set up the MyAEGEE development environment without installing Vagrant/VirtualBox. They should be able to run a single command that installs dependencies and starts all services directly on their host machine using Docker.

**Why this priority**: This is the core value proposition - eliminating the VM layer reduces resource consumption (no hypervisor overhead), improves performance (native Docker), and simplifies the setup for the majority of contributors who use Linux.

**Independent Test**: Can be fully tested by running the bootstrap script on a fresh Ubuntu 24.04 installation and verifying all services start successfully. Delivers immediate value by providing a working development environment in under 10 minutes.

**Acceptance Scenarios**:

1. **Given** a fresh Ubuntu 24.04 installation with no Docker installed, **When** the developer runs the bootstrap script, **Then** Docker, Docker Compose, and all prerequisites are automatically installed
2. **Given** Docker is installed but the repository is not cloned, **When** the developer runs the setup command, **Then** all git submodules are cloned recursively and all services start successfully
3. **Given** the system is running, **When** the developer visits http://my.appserver.test, **Then** the MyAEGEE frontend is accessible
4. **Given** the developer makes a code change in a service, **When** they save the file, **Then** the change is immediately reflected in the running container (hot reload works)

---

### User Story 2 - Seamless Development Workflow (Priority: P2)

A developer working on MyAEGEE should be able to use the same familiar commands (`make start`, `make stop`, `make monitor`) regardless of whether they're using Vagrant or direct Docker, with the system automatically detecting the environment.

**Why this priority**: Maintains backward compatibility for existing Vagrant users while enabling direct Docker usage. Reduces friction in transitioning between environments and allows teams with mixed setups to collaborate effectively.

**Independent Test**: Can be tested by running the same Makefile targets on both Vagrant-based and direct Docker setups, verifying identical behavior and outputs. Delivers value by preserving existing workflows.

**Acceptance Scenarios**:

1. **Given** a direct Docker setup on Ubuntu, **When** the developer runs `make start`, **Then** all enabled services start without requiring `vagrant ssh`
2. **Given** a Vagrant setup, **When** the developer runs `make start`, **Then** services start inside the VM as before (no breaking changes)
3. **Given** services are running, **When** the developer runs `make monitor core`, **Then** they see real-time logs from the core service regardless of setup type
4. **Given** the developer needs to execute a command in a container, **When** they run `./helper.sh --execute core "npm test"`, **Then** tests run in the core container and results display in the terminal

---

### User Story 3 - Intelligent Dependency Management (Priority: P2)

The system should automatically detect missing dependencies on Ubuntu and either install them automatically (with user permission) or provide clear instructions for manual installation, eliminating cryptic error messages.

**Why this priority**: Reduces onboarding friction and support burden. New contributors often struggle with prerequisite installation, especially when error messages are unclear. This improves the contributor experience significantly.

**Independent Test**: Can be tested by removing specific dependencies (Docker, Docker Compose, make, git) and running the bootstrap script, verifying appropriate detection and remediation for each missing component.

**Acceptance Scenarios**:

1. **Given** Docker is not installed, **When** the bootstrap script runs, **Then** it prompts the user for permission and installs Docker via the official Docker repository
2. **Given** the user's account is not in the `docker` group, **When** the setup detects this, **Then** it adds the user to the group and provides instructions to log out/in for the change to take effect
3. **Given** required system packages are missing (build-essential, git, make), **When** the script runs, **Then** it installs them automatically via apt
4. **Given** the user denies automatic installation, **When** prompted, **Then** the script provides a command they can run manually to install prerequisites

---

### User Story 4 - Port Conflict Resolution (Priority: P3)

When a developer has services already running on ports used by MyAEGEE (80, 443, 5432, etc.), the system should detect conflicts and either suggest alternative ports or help identify conflicting processes.

**Why this priority**: Port conflicts are a common pain point in local development. While less critical than basic functionality, this significantly improves the experience for developers who run multiple projects or have existing services.

**Independent Test**: Can be tested by starting a service on port 80 before running MyAEGEE setup, verifying the system detects the conflict and provides actionable guidance.

**Acceptance Scenarios**:

1. **Given** a web server is running on port 80, **When** the setup script detects the conflict, **Then** it reports which process is using the port and suggests stopping it or changing MyAEGEE's configuration
2. **Given** PostgreSQL is already installed and running on port 5432, **When** MyAEGEE tries to start its database, **Then** the system suggests using a different port for the containerized database
3. **Given** ports can be remapped, **When** the developer chooses alternative ports, **Then** all service configurations are updated accordingly and services communicate correctly

---

### User Story 5 - Environment Migration Path (Priority: P3)

An existing contributor using Vagrant should be able to migrate to direct Docker setup without losing their local data (databases, uploaded files, configuration), with a clear migration guide and automated tooling where possible.

**Why this priority**: Protects existing investment in development environments. Without a migration path, contributors might be reluctant to switch, limiting adoption of the improved workflow.

**Independent Test**: Can be tested by setting up a Vagrant environment with sample data, running the migration tool, and verifying all data is preserved in the new direct Docker setup.

**Acceptance Scenarios**:

1. **Given** a developer has a Vagrant setup with local data, **When** they run the migration script, **Then** database volumes are exported and imported into direct Docker volumes
2. **Given** custom configuration in Vagrant, **When** migrating, **Then** equivalent .env settings are preserved
3. **Given** the migration completes, **When** the developer starts the new setup, **Then** they see their existing test users and data intact
4. **Given** the migration fails at any point, **When** errors occur, **Then** the original Vagrant environment remains untouched and the developer can retry

---

### Edge Cases

- What happens when a developer has an older version of Docker that doesn't support the required features (Compose V2, BuildKit)?
- How does the system handle Ubuntu derivatives (Pop!\_OS, Linux Mint) that may have slightly different package management?
- What if the developer's system has limited disk space and Docker images consume available space?
- How does the system behave when network connectivity is poor or behind a corporate proxy?
- What happens if a developer tries to run both Vagrant and direct Docker setups simultaneously?
- How does the system handle SELinux or AppArmor policies that might restrict Docker operations?
- What if /etc/hosts editing requires sudo and the developer denies permission?
- How does the setup handle existing Docker networks with conflicting names?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST detect the operating system and version before attempting any setup
- **FR-002**: System MUST install Docker and Docker Compose automatically on Ubuntu 24.04 (with user permission)
- **FR-003**: System MUST configure /etc/hosts entries for local service access (my.appserver.test, etc.)
- **FR-004**: System MUST detect and report port conflicts before starting services
- **FR-005**: System MUST start all enabled services directly on the host machine without requiring a VM
- **FR-006**: System MUST maintain the same Makefile targets (`start`, `stop`, `monitor`, etc.) for both Vagrant and direct Docker modes
- **FR-007**: Helper scripts MUST automatically detect whether they're running inside Vagrant or on host and adjust accordingly
- **FR-008**: System MUST verify Docker daemon is running before attempting to start services
- **FR-009**: System MUST ensure the current user has Docker permissions (is in docker group)
- **FR-010**: System MUST provide a rollback mechanism if setup fails partway through
- **FR-011**: System MUST preserve existing Vagrant setup as a fallback option (not removed during direct Docker setup)
- **FR-012**: System MUST document minimum hardware requirements for direct Docker (CPU, RAM, disk space)
- **FR-013**: System MUST support hot reload for code changes without container rebuilds
- **FR-014**: System MUST provide equivalent logging and monitoring capabilities as Vagrant setup
- **FR-015**: System MUST handle git submodule initialization automatically

### Key Entities

- **Bootstrap Script**: The main entry point that orchestrates dependency installation, environment setup, and initial service startup on Ubuntu host
- **Environment Detector**: Component that identifies OS version, installed dependencies, Docker state, and determines whether running in Vagrant or direct mode
- **Prerequisites Manager**: Handles installation of Docker, Docker Compose, and system packages required for development
- **Port Checker**: Scans for port conflicts and provides remediation suggestions
- **Migration Tool**: Assists in moving from Vagrant-based setup to direct Docker, preserving data and configuration

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A new contributor with Ubuntu 24.04 can achieve a running MyAEGEE environment in under 10 minutes (excluding Docker image download time)
- **SC-002**: Memory consumption is reduced by at least 30% compared to Vagrant setup (no hypervisor overhead)
- **SC-003**: Hot reload for code changes takes under 3 seconds for 90% of file types
- **SC-004**: Zero breaking changes for existing Vagrant users (all current workflows continue to function)
- **SC-005**: Setup success rate exceeds 95% on fresh Ubuntu 24.04 installations
- **SC-006**: Docker container startup time is under 60 seconds for all services combined (after images are built)
- **SC-007**: Documentation enables a first-time contributor to complete setup without external support
- **SC-008**: At least 80% of current Vagrant users successfully migrate to direct Docker within 2 weeks of release

## Assumptions

- Developers using Ubuntu 24.04 have sudo privileges (required for Docker installation and /etc/hosts editing)
- The host machine meets minimum hardware requirements: 8GB RAM, 4 CPU cores, 20GB available disk space
- Internet connectivity is available during initial setup for downloading Docker images and apt packages
- The system uses systemd (standard for Ubuntu 24.04) for service management
- Docker Compose V2 is the target version (integrated as `docker compose`, not standalone `docker-compose`)
- Existing Vagrant setup uses the standard configuration in the current repository
- MacOS and Windows support will be added in future iterations and are explicitly out of scope for this specification

## Dependencies

- Docker Engine (version 24.0+)
- Docker Compose V2 (bundled with Docker Engine)
- Git (for submodule management)
- Make (for Makefile targets)
- Standard Ubuntu packages: curl, ca-certificates, gnupg, build-essential

## Out of Scope

- MacOS support (deferred to future work)
- Windows support (deferred to future work)
- Modification of individual microservice Docker configurations
- Changes to production deployment procedures
- Performance optimization of existing services (focus is on setup process only)
- GUI-based setup tool (command-line only for this iteration)

## Risks and Mitigations

**Risk**: Direct Docker setup may expose host system to security vulnerabilities if containers are misconfigured
**Mitigation**: Maintain non-root user usage in containers, use Docker security scanning, document security best practices

**Risk**: Developers may accidentally delete host-mounted volumes and lose data
**Mitigation**: Use named Docker volumes instead of bind mounts where possible, provide clear backup/restore documentation

**Risk**: Ubuntu version fragmentation (20.04, 22.04, 24.04) may require different installation procedures
**Mitigation**: Focus exclusively on 24.04 LTS for initial release, add detection for unsupported versions

**Risk**: Breaking changes in helper.sh may affect CI/CD pipelines that depend on those scripts
**Mitigation**: Maintain backward compatibility through environment detection, test against existing CI workflows

**Risk**: Network configuration differences between VM and host may cause service discovery issues
**Mitigation**: Use Docker Compose networks exclusively, avoid reliance on VM-specific networking

## Constitution Alignment

This specification aligns with the MyAEGEE Constitution as follows:

- **Principle II (Docker-First Development)**: Enhances by removing VM layer while maintaining Docker-based consistency
- **Principle V (Configuration via Environment)**: Preserves .env file usage, adds OS-specific detection
- **Principle VII (Git Submodules)**: No changes to submodule structure or workflow
- **Development Workflow**: Maintains existing Makefile and helper.sh interfaces for compatibility
- **Quality Standards**: Setup process must include validation steps to ensure all services start correctly

No constitutional amendments required - this is an implementation improvement that strengthens existing principles

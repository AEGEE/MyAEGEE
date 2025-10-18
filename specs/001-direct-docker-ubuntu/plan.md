# Implementation Plan: Direct Docker Development on Ubuntu

**Branch**: `001-direct-docker-ubuntu` | **Date**: 2025-10-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-direct-docker-ubuntu/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable MyAEGEE developers on Ubuntu 24.04 to run the complete development environment directly on their host machine using Docker, eliminating the Vagrant/VirtualBox VM layer. This reduces resource overhead by ~30%, improves performance, and simplifies the onboarding process to under 10 minutes. The implementation maintains full backward compatibility with existing Vagrant-based workflows through intelligent environment detection in helper scripts.

## Technical Context

**Language/Version**: Bash 5.x (for setup scripts), existing Node.js/Python/Elixir versions unchanged  
**Primary Dependencies**: Docker Engine 24.0+, Docker Compose V2, Make, Git, standard Ubuntu packages (curl, ca-certificates, build-essential)  
**Storage**: Docker volumes (named volumes for persistence), /etc/hosts (for DNS), .env file (for configuration)  
**Testing**: Manual validation on fresh Ubuntu 24.04, automated smoke tests via bats (Bash Automated Testing System)  
**Target Platform**: Ubuntu 24.04 LTS (x86_64), future: MacOS, Windows  
**Project Type**: DevOps/Infrastructure (scripts and configuration, no application code changes)  
**Performance Goals**: Setup complete in <10 minutes (excluding Docker image downloads), hot reload <3 seconds, container startup <60 seconds  
**Constraints**: Must maintain Vagrant compatibility, zero breaking changes to existing workflows, sudo access required for Docker installation and /etc/hosts  
**Scale/Scope**: ~15 microservices, 8GB RAM minimum, 20GB disk space, estimated 5-10 script files to modify/create

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Principle I: Microservices Architecture (NON-NEGOTIABLE)

✅ **PASS** - No changes to microservice architecture. Each service continues to operate independently in Docker containers.

### Principle II: Docker-First Development

✅ **PASS** - **STRENGTHENED** - Enhances Docker-first approach by removing VM layer while maintaining container isolation. Development environment still mirrors production. Helper scripts continue to abstract Docker complexity.

### Principle III: Test-Driven Quality (NON-NEGOTIABLE)

✅ **PASS** - No changes to testing requirements. Setup scripts will include validation tests (bats), existing service tests unchanged.

### Principle IV: Traefik-Routed Service Discovery

✅ **PASS** - No changes to Traefik routing. Services continue using Docker labels for routing, subdomain-based access preserved.

### Principle V: Configuration via Environment

✅ **PASS** - Preserves `.env` file usage, enhances with OS detection logic. No changes to secret management or environment switching.

### Principle VI: Modular Service Structure

✅ **PASS** - No changes to service internal structure. Setup process interacts only with Docker configurations.

### Principle VII: Git Submodules for Service Composition

✅ **PASS** - Preserves git submodule structure. Setup scripts will ensure `--recursive` cloning works correctly.

### Development Workflow Compliance

✅ **PASS** - Maintains existing Makefile targets and helper.sh interface. Adds environment detection without breaking changes.

### Quality Standards Compliance

✅ **PASS** - Setup validation ensures all services start correctly. Documentation will be comprehensive for Ubuntu 24.04.

**GATE STATUS: ✅ ALL CHECKS PASSED - No constitutional violations. Proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```
specs/001-direct-docker-ubuntu/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (see below)
├── quickstart.md        # Phase 1 output (Ubuntu 24.04 setup guide)
├── checklists/
│   └── requirements.md  # Specification quality checklist (✅ APPROVED)
└── spec.md              # Feature specification
```

### Source Code (repository root)

```
MyAEGEE/
├── scripts-ubuntu/                    # NEW: Direct Docker scripts for Ubuntu
│   ├── bootstrap.sh                   # Main entry point for Ubuntu setup
│   ├── install-docker.sh              # Docker installation automation
│   ├── check-prerequisites.sh         # Dependency detection
│   ├── setup-hosts.sh                 # /etc/hosts configuration
│   ├── check-ports.sh                 # Port conflict detection
│   └── migrate-from-vagrant.sh        # Vagrant to direct Docker migration
│
├── helper.sh                          # MODIFY: Add environment detection
├── start.sh                           # MODIFY: Support --ubuntu flag
├── Makefile                           # MODIFY: Maintain compatibility
├── .env                               # EXISTING: No changes needed
├── .env.example                       # MODIFY: Document MYAEGEE_RUNTIME
│
├── README.md                          # MODIFY: Add Ubuntu direct setup section
├── docs/
│   └── setup-ubuntu-direct.md         # NEW: Comprehensive Ubuntu guide
│
├── tests/
│   └── setup/
│       ├── test-bootstrap.bats        # NEW: Bootstrap script tests
│       ├── test-environment-detect.bats  # NEW: Environment detection tests
│       └── test-docker-setup.bats     # NEW: Docker installation tests
│
└── [existing services unchanged]
```

**Structure Decision**: Created new `scripts-ubuntu/` directory to isolate Ubuntu-specific setup logic while preserving existing Vagrant infrastructure in `scripts-vagrant_provision/`. Modified core orchestration scripts (`helper.sh`, `start.sh`, `Makefile`) to add environment detection without removing Vagrant support. Testing infrastructure uses bats (Bash Automated Testing System) to validate setup scripts.

## Complexity Tracking

_This feature does NOT violate constitutional principles. No complexity justification required._

All changes enhance existing principles without introducing architectural complexity:

- Docker-First Development: Strengthened by removing VM layer
- Configuration via Environment: Extended with runtime detection
- Development Workflow: Preserved with backward compatibility

## Phase 0: Research & Technical Decisions

### Research Topics

1. **Docker Installation on Ubuntu 24.04**

   - **Decision**: Use official Docker apt repository installation method
   - **Rationale**: Most reliable, provides latest stable versions, automatic updates via apt
   - **Alternatives considered**:
     - Snap package (rejected: older versions, snap overhead)
     - Manual binary installation (rejected: no automatic updates)
     - Docker Desktop for Linux (rejected: unnecessary GUI, more overhead)
   - **Implementation**: Add Docker's GPG key and repository, install docker-ce, docker-ce-cli, containerd.io

2. **Environment Detection Strategy**

   - **Decision**: Check for `/vagrant` directory and `VAGRANT` environment variable
   - **Rationale**: Simple, reliable indicators that code is running inside Vagrant VM
   - **Alternatives considered**:
     - Check for VirtualBox kernel modules (rejected: false positives)
     - Parse hostname patterns (rejected: unreliable, customizable)
   - **Implementation**: Add `is_vagrant()` function to helper.sh returning boolean

3. **Docker Group Permission Handling**

   - **Decision**: Add user to docker group automatically, require logout/login for activation
   - **Rationale**: Standard Docker setup, avoids sudo for every docker command
   - **Alternatives considered**:
     - Use sudo for all docker commands (rejected: poor UX)
     - Use newgrp to activate immediately (rejected: spawns subshell, confusing)
   - **Implementation**: `sudo usermod -aG docker $USER`, display logout instruction

4. **Port Conflict Detection Method**

   - **Decision**: Use `ss -tuln` to check listening ports before starting services
   - **Rationale**: Fast, standard tool on modern Linux, shows PID and process name
   - **Alternatives considered**:
     - `netstat` (rejected: deprecated, not installed by default on Ubuntu 24.04)
     - `lsof` (rejected: slower, requires parsing)
     - Attempt to bind and catch error (rejected: side effects)
   - **Implementation**: Parse `ss` output for ports 80, 443, 5432, etc., suggest remediation

5. **Hot Reload Implementation**

   - **Decision**: Use Docker bind mounts for source code, existing service hot reload mechanisms unchanged
   - **Rationale**: Native Docker feature, works for most file types, services already support it
   - **Alternatives considered**:
     - Docker volumes with sync tools (rejected: complexity, performance overhead)
     - Code changes require rebuild (rejected: poor DX, slow iteration)
   - **Implementation**: Ensure docker-compose.dev.yml uses bind mounts (already present), verify inotify limits

6. **Testing Framework for Setup Scripts**

   - **Decision**: Use bats (Bash Automated Testing System) for script validation
   - **Rationale**: Purpose-built for Bash testing, TAP output, easy to read/write
   - **Alternatives considered**:
     - ShellSpec (rejected: less adoption, more complex)
     - Manual test scripts (rejected: no structure, hard to maintain)
     - No testing (rejected: violates Test-Driven Quality principle)
   - **Implementation**: Install bats-core via apt, create test files in tests/setup/

7. **/etc/hosts Management**

   - **Decision**: Append entries if missing, preserve existing content, require sudo
   - **Rationale**: Safe, non-destructive, standard practice for local development DNS
   - **Alternatives considered**:
     - Use dnsmasq/systemd-resolved (rejected: overkill, extra dependency)
     - Use browser extensions (rejected: doesn't work for CLI tools, API calls)
     - Hardcode IPs in configs (rejected: violates Configuration via Environment)
   - **Implementation**: Check for existing entries, append block with marker comments, idempotent

8. **Migration Tool Data Preservation**
   - **Decision**: Use `docker cp` to export Vagrant VM volumes, import to named Docker volumes
   - **Rationale**: Standard Docker approach, preserves permissions, atomic operation
   - **Alternatives considered**:
     - Database dumps/restores (rejected: service-specific, incomplete for file storage)
     - rsync between VM and host (rejected: complex, requires VM running)
     - Manual backup instructions only (rejected: error-prone, low adoption)
   - **Implementation**: Identify volume containers, tar content, extract to new volumes

### Technical Constraints Identified

1. **Minimum Docker Version**: 24.0+ required for Compose V2 integration and BuildKit

   - **Impact**: Must detect and reject older versions with clear upgrade instructions
   - **Mitigation**: Check `docker --version`, parse output, display upgrade guide

2. **inotify Watch Limits**: Default 8192 watches may be insufficient for large codebase

   - **Impact**: Hot reload may fail silently or only work for some files
   - **Mitigation**: Increase `fs.inotify.max_user_watches` to 524288 via sysctl

3. **Disk Space**: Docker images can consume 10-15GB, builds require temp space

   - **Impact**: Setup may fail on systems with <20GB free
   - **Mitigation**: Check available space before starting, warn if <20GB, error if <10GB

4. **Network**: Corporate proxies may block Docker registry access

   - **Impact**: Image pulls fail with obscure errors
   - **Mitigation**: Document proxy configuration in quickstart, check connectivity to ghcr.io

5. **Parallel Vagrant/Direct Use**: Running both simultaneously causes network conflicts
   - **Impact**: Services unreachable, port binding errors
   - **Mitigation**: Detect running Vagrant VM, warn user, suggest stopping

### Dependencies to Install

**Core**:

- docker-ce (24.0+) - Container runtime
- docker-ce-cli - Docker command line
- containerd.io - Container runtime
- docker-compose-plugin - Compose V2 (bundled with Docker Engine)

**Build Tools**:

- make - Makefile execution
- build-essential - gcc, g++, libc-dev (for native module compilation)
- git - Version control, submodule management

**Utilities**:

- curl - Downloads, API calls
- ca-certificates - SSL certificate validation
- gnupg - GPG key verification for Docker repository
- apt-transport-https - Secure apt repository access

**Testing**:

- bats - Bash testing framework (installed separately via git)

**Optional**:

- jq - JSON parsing (already in project dependencies)
- netcat-openbsd - Port testing (nc command)

| Violation | Why Needed                 | Simpler Alternative Rejected Because      |
| --------- | -------------------------- | ----------------------------------------- |
| N/A       | No constitution violations | Implementation aligns with all principles |

**Gate Status**: ✅ ALL CHECKS PASSED - Proceed to Phase 0

---

## Phase 0: Research Complete

### Artifacts Generated

✅ **research.md** - Technical decisions document with 8 research topics:

1.  Docker installation method
2.  Environment detection strategy
3.  Docker group permission handling
4.  Port conflict detection method
5.  Hot reload implementation
6.  Testing framework selection
7.  /etc/hosts management approach
8.  Migration tool data preservation

All decisions documented with rationale, alternatives considered, and implementation approach. See [research.md](research.md) for full details.

**Phase 0 Gate**: ✅ PASS - All technical uncertainties resolved, ready for design phase

---

## Phase 1: Design & Contracts

### 1.1 Data Model

**N/A** - No database changes or new entities. This is an infrastructure/tooling feature.

**Relevant existing structures**:

- `.env` file: Existing configuration format, add optional `MYAEGEE_ENVIRONMENT=vagrant|direct` for explicit override
- `/etc/hosts`: System file, append-only additions for local DNS
- Docker volumes: Named volumes follow existing naming pattern `myaegee_<service>_data`
- Git submodules: Existing structure at root level (core/, events/, frontend/, etc.)

### 1.2 Quickstart Guide

✅ **Generated**: [quickstart.md](quickstart.md)

**Key sections**:

1. **Prerequisites** - System requirements, Ubuntu 24.04 verification
2. **Quick Setup** - TL;DR one-liner for experienced users
3. **Step-by-Step Setup** - Detailed walkthrough with expected outputs
   - Clone repository with submodules
   - Run bootstrap.sh
   - Activate docker group (logout/login)
   - Start services with make
   - Verify installation
4. **Common Tasks** - Starting/stopping, logs, migrations, hot reload testing
5. **Troubleshooting** - Port conflicts, permissions, DNS, slow reload, disk space
6. **Migrating from Vagrant** - Data preservation, side-by-side testing
7. **Next Steps** - Development workflow, documentation links, getting help

**Target audience**: Developers new to the project or migrating from Vagrant

### 1.3 Agent Context Update

Run after completing this plan:

```bash
cd /home/wikirik/Repositories/MyAEGEE
.specify/scripts/bash/update-agent-context.sh copilot
```

This updates `.specify/memory/copilot-agent-context.md` with:

- Feature specification summary
- Implementation plan structure
- Key technical decisions from research
- File paths for generated artifacts

---

## Phase 2: Implementation Planning

### 2.1 File Structure

**New directory**: `scripts-ubuntu/`

```
scripts-ubuntu/
├── bootstrap.sh              # Main entry point, orchestrates setup
├── check-prerequisites.sh    # Verify OS, check existing installations
├── install-docker.sh         # Docker Engine + Compose V2 installation
├── setup-permissions.sh      # Add user to docker group
├── setup-hosts.sh            # Configure /etc/hosts
├── setup-environment.sh      # Create .env from template
├── validate-installation.sh  # Run smoke tests
└── migrate-from-vagrant.sh   # Export data from Vagrant, import to Docker
```

**Modified files**:

- `helper.sh` - Add environment detection, adjust docker command routing
- `start.sh` - Add OS detection, call appropriate bootstrap
- `Makefile` - Add `make bootstrap-ubuntu` target
- `.env.example` - Add `MYAEGEE_ENVIRONMENT` variable
- `README.md` - Add "Direct Docker on Ubuntu" section

**New documentation**:

- `docs/setup-ubuntu-direct.md` - Comprehensive setup guide (links to quickstart.md)
- `docs/troubleshooting-ubuntu.md` - Known issues and solutions

**New tests**:

```
tests/setup/
├── test-bootstrap.bats           # Test bootstrap script
├── test-environment-detection.bats  # Test is_vagrant() function
└── test-docker-installation.bats   # Test Docker installation
```

### 2.2 Complexity Tracking

| Task                     | Est. Lines | Complexity | Risk                                |
| ------------------------ | ---------- | ---------- | ----------------------------------- |
| bootstrap.sh             | 150        | Medium     | Low - Standard bash patterns        |
| check-prerequisites.sh   | 80         | Low        | Low - Simple version checks         |
| install-docker.sh        | 200        | Medium     | Medium - Apt repository management  |
| setup-permissions.sh     | 50         | Low        | Low - Single usermod command        |
| setup-hosts.sh           | 60         | Low        | Low - Append to file                |
| setup-environment.sh     | 40         | Low        | Low - Copy template                 |
| validate-installation.sh | 100        | Medium     | Low - Run test commands             |
| migrate-from-vagrant.sh  | 250        | High       | High - Data integrity critical      |
| helper.sh modifications  | 30         | Low        | Low - Add function, minimal changes |
| start.sh modifications   | 20         | Low        | Low - Add OS detection              |
| Makefile additions       | 10         | Low        | Low - Add one target                |
| bats tests               | 300        | Medium     | Low - Standard test patterns        |
| Documentation            | 200        | Low        | Low - Markdown writing              |
| **TOTAL**                | **~1490**  | **Medium** | **Medium**                          |

**Complexity Justification**:

- Most scripts are straightforward Bash with standard patterns
- Highest complexity is migrate-from-vagrant.sh (data handling, multiple services)
- Risk mitigated by:
  - Comprehensive testing (bats)
  - Non-destructive approach (Vagrant data preserved)
  - Clear rollback instructions
  - Validation at each step

### 2.3 Validation & Testing Strategy

#### Unit Tests (bats)

**test-bootstrap.bats**:

```bash
@test "detect Ubuntu 24.04 correctly" {
    run scripts-ubuntu/check-prerequisites.sh --detect-os
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Ubuntu 24.04" ]]
}

@test "reject unsupported OS versions" {
    # Mock /etc/os-release for Ubuntu 20.04
    run scripts-ubuntu/check-prerequisites.sh --detect-os
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Ubuntu 24.04 required" ]]
}

@test "check for Docker installation" {
    run scripts-ubuntu/check-prerequisites.sh --check-docker
    # Pass if Docker 24.0+ installed, fail with message if not
}

@test "check for sufficient disk space" {
    run scripts-ubuntu/check-prerequisites.sh --check-disk
    # Require 20GB free
}

@test "check for port conflicts" {
    run scripts-ubuntu/check-prerequisites.sh --check-ports
    # Test ports 80, 443, 5432
}
```

**test-environment-detection.bats**:

```bash
@test "detect Vagrant environment via /vagrant directory" {
    mkdir -p /tmp/test-vagrant/vagrant
    cd /tmp/test-vagrant
    run bash -c 'source helper.sh; is_vagrant && echo "vagrant" || echo "host"'
    [ "$output" = "vagrant" ]
}

@test "detect host environment when no /vagrant" {
    cd /tmp
    run bash -c 'source helper.sh; is_vagrant && echo "vagrant" || echo "host"'
    [ "$output" = "host" ]
}

@test "detect Vagrant via environment variable" {
    export VAGRANT=1
    run bash -c 'source helper.sh; is_vagrant && echo "vagrant" || echo "host"'
    [ "$output" = "vagrant" ]
}
```

**test-docker-installation.bats**:

```bash
@test "Docker version is 24.0 or higher" {
    run docker --version
    [ "$status" -eq 0 ]
    # Parse version and assert >= 24.0
}

@test "Docker Compose V2 is available" {
    run docker compose version
    [ "$status" -eq 0 ]
    [[ "$output" =~ "v2." ]]
}

@test "user is in docker group" {
    run groups
    [[ "$output" =~ "docker" ]]
}

@test "Docker daemon is running" {
    run docker ps
    [ "$status" -eq 0 ]
}
```

#### Integration Tests

**Manual testing checklist** (documented in quickstart.md):

1. ✅ Fresh Ubuntu 24.04 VM setup
2. ✅ Run bootstrap.sh, verify no errors
3. ✅ Logout/login, verify docker group active
4. ✅ Run make start, all containers start
5. ✅ Access http://my.appserver.test, frontend loads
6. ✅ Edit core/lib/server.js, verify hot reload <3s
7. ✅ Run make stop, all containers stop cleanly
8. ✅ Run migrate-from-vagrant.sh, data preserved
9. ✅ Verify migrated data intact (login, view events)

#### Acceptance Criteria Validation

From spec.md Success Criteria:

| Criterion              | How Validated                             | Pass Threshold             |
| ---------------------- | ----------------------------------------- | -------------------------- |
| Resource efficiency    | Compare `free -h` before/after vs Vagrant | >25% memory saving         |
| Setup time             | Time `bootstrap.sh` + `make start`        | <10 minutes total          |
| Hot reload speed       | Time from file save to log output         | <3 seconds                 |
| Zero breaking changes  | Vagrant workflow still works              | All existing commands work |
| Documentation complete | Quickstart walkthrough                    | New dev completes setup    |

#### CI Integration

Add to `.circleci/config.yml`:

```yaml
test-ubuntu-setup-scripts:
  machine:
    image: ubuntu-2404:current
  steps:
    - checkout
    - run:
        name: Install bats
        command: |
          sudo apt-get update
          sudo apt-get install -y bats
    - run:
        name: Run setup script tests
        command: |
          cd /home/wikirik/Repositories/MyAEGEE
          bats tests/setup/
    - run:
        name: Validate bootstrap (dry-run mode)
        command: |
          ./scripts-ubuntu/bootstrap.sh --dry-run
```

### 2.4 Risk Mitigation

| Risk                                                    | Likelihood | Impact   | Mitigation                                                                            |
| ------------------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------- |
| Docker installation fails on some Ubuntu 24.04 variants | Medium     | High     | Comprehensive error handling, fallback instructions, pre-flight checks                |
| Existing Vagrant users accidentally break their setup   | Low        | High     | Clear documentation, environment detection prevents conflicts, Vagrant data untouched |
| Port conflicts with other services                      | Medium     | Medium   | Port conflict detection in bootstrap, clear error messages, configuration guidance    |
| Migration tool loses data                               | Low        | Critical | Dry-run mode, backup verification, manual alternative documented                      |
| Performance doesn't meet targets                        | Low        | Medium   | Benchmarking in Phase 0, optimization phase if needed, clear metrics                  |
| Hot reload doesn't work consistently                    | Medium     | Medium   | inotify limit increase, fallback to polling mode, troubleshooting guide               |
| Corporate firewalls block Docker registry               | Medium     | Medium   | Proxy documentation, connectivity test in bootstrap, offline fallback instructions    |

**Rollback Plan**:

1. Vagrant setup remains fully functional
2. No changes to docker-compose files (backward compatible)
3. Scripts in separate directory (easy to ignore/delete)
4. Migration tool preserves original Vagrant data
5. Documentation includes "Switching back to Vagrant" section

### 2.5 Dependencies & Prerequisites

**Before starting implementation**:

- [ ] Implementation plan reviewed and approved
- [ ] Fresh Ubuntu 24.04 test environment available
- [ ] Vagrant environment available for migration testing
- [ ] CircleCI access for CI configuration

**Development dependencies**:

- Shellcheck (bash linting): `sudo apt install shellcheck`
- bats (testing): `sudo apt install bats` or build from source
- Docker (for local testing): Already installed via bootstrap

**Documentation dependencies**:

- Markdown editor with preview
- Access to existing documentation for consistency

---

## Phase 3: Task Breakdown

**Next step**: Run `/speckit.tasks` to generate tasks.md with actionable tickets.

**Estimated task structure**:

1. **Setup & Infrastructure** (2-3 tasks)

   - Create scripts-ubuntu/ directory structure
   - Set up bats testing framework
   - Add CI job for script testing

2. **Core Scripts** (6-8 tasks)

   - Implement check-prerequisites.sh
   - Implement install-docker.sh
   - Implement setup-permissions.sh
   - Implement setup-hosts.sh
   - Implement setup-environment.sh
   - Implement validate-installation.sh
   - Implement bootstrap.sh (orchestrator)
   - Implement migrate-from-vagrant.sh

3. **Integration** (3-4 tasks)

   - Modify helper.sh for environment detection
   - Modify start.sh for OS detection
   - Add Makefile targets
   - Update .env.example

4. **Testing** (3-4 tasks)

   - Write bats tests for bootstrap
   - Write bats tests for environment detection
   - Write bats tests for Docker installation
   - Manual integration testing on fresh Ubuntu 24.04

5. **Documentation** (2-3 tasks)

   - Update README.md with Ubuntu setup section
   - Create docs/setup-ubuntu-direct.md
   - Create docs/troubleshooting-ubuntu.md
   - Review and refine quickstart.md

6. **Validation & Release** (2-3 tasks)
   - Run full acceptance criteria tests
   - Performance benchmarking
   - Migration testing with real Vagrant data
   - Final review and merge

**Total estimated tasks**: 18-25 individual tasks

---

## Success Criteria Recap

Implementation complete when:

✅ **FR-001**: Ubuntu 24.04 detection implemented with clear error for unsupported OS  
✅ **FR-002**: Docker and dependencies installed automatically via bootstrap.sh  
✅ **FR-003**: Environment detection (is_vagrant function) works correctly  
✅ **FR-004**: All services start and run on host Docker  
✅ **FR-005**: Port conflict detection warns before starting  
✅ **FR-006**: /etc/hosts configured automatically  
✅ **FR-007**: Makefile targets work for both environments  
✅ **FR-008**: Hot reload <3s verified with bats tests  
✅ **FR-009**: Quickstart guide complete and tested  
✅ **FR-010**: Migration tool preserves all data  
✅ **FR-011**: No changes to existing Vagrant workflow  
✅ **FR-012**: Comprehensive troubleshooting documented  
✅ **FR-013**: bats tests cover all critical paths  
✅ **FR-014**: CI validates scripts on every commit  
✅ **FR-015**: Setup completes in <10 minutes

**Acceptance criteria**:

- Resource efficiency: >25% memory reduction vs Vagrant
- Setup time: <10 minutes from git clone to running services
- Hot reload: <3 seconds from file save to reflection
- Zero breaking changes: All Vagrant workflows still functional
- Documentation: New developer completes setup without assistance

---

## Implementation Plan Complete

**Status**: ✅ READY FOR TASK GENERATION  
**Next command**: `/speckit.tasks`  
**Branch**: `001-direct-docker-ubuntu`  
**Artifacts**:

- [spec.md](spec.md) - Feature specification
- [research.md](research.md) - Technical decisions
- [quickstart.md](quickstart.md) - User-facing setup guide
- [plan.md](plan.md) - This implementation plan (you are here)

**Agent context updated**: Run `.specify/scripts/bash/update-agent-context.sh copilot` to sync AI context.

---

**Phase Gate Status**:

- Phase 0 Research: ✅ COMPLETE
- Phase 1 Design: ✅ COMPLETE
- Phase 2 Planning: ✅ COMPLETE
- Phase 3 Tasks: ⏳ READY TO GENERATE

**Implementation can begin after task breakdown.**

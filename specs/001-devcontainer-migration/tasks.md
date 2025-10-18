# Tasks: Dev Container Migration

**Input**: Design documents from `/specs/001-devcontainer-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: This is an infrastructure feature. Testing is manual validation of container builds, service startup, and port accessibility.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- `.devcontainer/` - Dev container configuration files
- `docs/` - Documentation
- Repository root - Configuration files

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create basic dev container structure and configuration files

- [x] T001 Create `.devcontainer/` directory structure at repository root
- [x] T002 Create `.devcontainer/scripts/` directory for automation scripts
- [x] T003 Create `docs/` directory if it doesn't exist for documentation
- [x] T004 [P] Create `.devcontainer/.gitignore` to exclude log files
- [x] T005 [P] Create `.devcontainer/scripts/utils.sh` with common helper functions (RAM detection, color output, logging)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create `.devcontainer/Dockerfile` with base image `mcr.microsoft.com/devcontainers/base:ubuntu-22.04` and essential tools (curl, git, Node.js setup)
- [x] T007 Create base `.devcontainer/docker-compose.devcontainer.yml` with workspace service definition and network configuration
- [x] T008 Configure Docker volume definitions in `.devcontainer/docker-compose.devcontainer.yml` for all databases (myaegee-core-db, myaegee-events-db, myaegee-statutory-db, myaegee-discounts-db, myaegee-summeruniversity-db, myaegee-network-db, myaegee-knowledge-db)
- [x] T009 Create `.devcontainer/scripts/health-check.sh` script with functions to check service health (PostgreSQL, HTTP endpoints)
- [x] T010 [P] Create `.devcontainer/scripts/post-create.sh` script skeleton with platform detection and logging setup

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Local Development Setup (Priority: P1) 🎯 MVP

**Goal**: Enable one-click dev environment setup in VS Code with all services starting automatically via localhost ports

**Independent Test**: Clone repository, open in VS Code, accept "Reopen in Container" prompt. After build, access http://localhost:3000 (frontend), http://localhost:8084 (core API), http://localhost:8080 (traefik). Verify hot-reload by editing a frontend file.

### Implementation for User Story 1

- [x] T011 [US1] Create `.devcontainer/devcontainer.json` with name, dockerComposeFile references, workspace service config, and VS Code customizations (extensions: ESLint, EditorConfig, Docker)
- [x] T012 [US1] Add port forwarding configuration to `.devcontainer/devcontainer.json` for all services (3000, 8080, 8084, 8085, 8086, 8087, 8088, 8089, 8090, 8091, 8092, 9000, 5050)
- [x] T013 [US1] Configure postCreateCommand and postStartCommand in `.devcontainer/devcontainer.json` pointing to scripts
- [x] T014-T022 [US1] [ARCHITECTURE DECISION] Simplified service orchestration - Using host networking in docker-compose.devcontainer.yml instead of defining all services. Services are started via existing helper.sh infrastructure (preserves Vagrant compatibility, avoids duplication)
- [x] T023 [US1] Implement `.devcontainer/scripts/post-create.sh` to generate `.env.devcontainer` file with localhost URLs (BASE_URL=localhost, SUBDOMAIN_FRONTEND=http://localhost:3000, SUBDOMAIN_CORE=http://localhost:8084, etc.)
- [x] T024 [US1] Add shell alias setup to `.devcontainer/scripts/post-create.sh` creating `.devcontainer/aliases.sh` with shortcuts (make commands, docker helpers)
- [x] T025 [US1] Implement `.devcontainer/scripts/post-start.sh` to display startup banner with "MyAEGEE Development Environment" header
- [x] T026 [US1] Add service startup monitoring to `.devcontainer/scripts/post-start.sh` with progress indicators ([1/3] Databases, [2/3] Backend Services, [3/3] Frontend & Tools)
- [x] T027 [US1] Add health check waiting logic to `.devcontainer/scripts/post-start.sh` using health-check.sh functions with retry logic
- [x] T028 [US1] Add service URL display to `.devcontainer/scripts/post-start.sh` showing all access URLs (Application, APIs, Admin Tools)
- [x] T029 [US1] Add quick commands reference to `.devcontainer/scripts/post-start.sh` output (make start, make stop, make restart, make reset-db, make logs)
- [x] T030 [US1] Add error handling to `.devcontainer/scripts/post-start.sh` for Docker not running with clear actionable message
- [x] T031 [US1] Add error handling to `.devcontainer/scripts/post-start.sh` for port conflicts with detection and resolution instructions (lsof command)
- [x] T032 [US1] Add error handling to `.devcontainer/scripts/post-start.sh` for service health check failures with log viewing instructions
- [x] T033 [US1] Configure workspace mount in `.devcontainer/devcontainer.json` with bind mount, cached consistency for hot-reload support
- [x] T034 [US1] Update `README.md` with Dev Container setup section including prerequisites (Docker, VS Code, Dev Containers extension), quick start steps (clone, open, reopen in container), and service URLs table
- [x] T035 [US1] Create `docs/dev-setup-devcontainer.md` with comprehensive dev container setup guide based on quickstart.md (prerequisites, step-by-step, troubleshooting, differences from Vagrant)

**Checkpoint**: At this point, User Story 1 should be fully functional - developers can open repo in VS Code and start developing with all services accessible via localhost ports

---

## Phase 4: User Story 2 - GitHub Codespaces Development (Priority: P2)

**Goal**: Enable zero-setup cloud-based development via GitHub Codespaces with automatic port forwarding

**Independent Test**: Go to GitHub repository, click Code > Codespaces > Create codespace. After build, access services via GitHub's forwarded port URLs. Verify hot-reload and data persistence after stopping/starting Codespace.

### Implementation for User Story 2

- [x] T036 [US2] Create `.github/workflows/codespaces-prebuild.yml` workflow for prebuild automation (triggers on push to main/develop branches)
- [x] T037 [US2] Configure prebuild workflow in `.github/workflows/codespaces-prebuild.yml` to build dev container image using actions/cache for Docker layers
- [x] T038 [US2] Add Codespaces-specific environment detection to `.devcontainer/scripts/post-start.sh` checking for CODESPACES=true environment variable
- [x] T039 [US2] Add Codespaces-specific URL display to `.devcontainer/scripts/post-start.sh` showing GitHub port forwarding URL format (https://USERNAME-REPO-PORT.githubpreview.dev)
- [x] T040 [US2] Add Codespaces port visibility configuration to `.devcontainer/devcontainer.json` setting ports to public for external access
- [x] T041 [US2] Update `README.md` with GitHub Codespaces section explaining how to create a Codespace, access forwarded ports, and expected build time
- [x] T042 [US2] Add Codespaces-specific troubleshooting to `docs/dev-setup-devcontainer.md` covering port forwarding, quota limits, and stopping/starting Codespaces
- [x] T043 [US2] Test Codespaces port forwarding URLs update dynamically in Ports tab when services start

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - local dev containers AND Codespaces

---

## Phase 5: User Story 3 - Database and State Management (Priority: P3)

**Goal**: Database data persists between container restarts, with easy reset command for clean state

**Independent Test**: Start dev container, create test data via application (register user, create event), stop container, restart container, verify data still exists. Run reset command, verify databases recreated with default seed data.

### Implementation for User Story 3

- [x] T044 [US3] Verify volume mount configuration in `.devcontainer/docker-compose.devcontainer.yml` for all PostgreSQL services (already configured in T008, validate correctness for all 7 database volumes)
- [x] T045 [US3] Create `Makefile` target `reset-db` at repository root that stops services, removes volumes, and restarts with re-seeding
- [x] T046 [US3] Implement reset-db target to call `docker volume rm` for all database volumes (myaegee-core-db, myaegee-events-db, myaegee-statutory-db, myaegee-discounts-db, myaegee-summeruniversity-db, myaegee-network-db, myaegee-knowledge-db)
- [x] T047 [US3] Implement reset-db target to call `docker-compose restart` for database services to trigger automatic re-creation and migration
- [x] T048 [US3] Add seed profile environment variable support to `.devcontainer/scripts/post-create.sh` checking for SEED_PROFILE (default|minimal|custom)
- [x] T049 [US3] Update post-create script to set SEED_PROFILE=default in `.env.devcontainer` if not specified
- [x] T050 [US3] Create `Makefile` target `reset-db-minimal` that sets SEED_PROFILE=minimal before running reset logic
- [x] T051 [US3] Update `.devcontainer/scripts/post-start.sh` to display current seed profile in startup message
- [x] T052 [US3] Add database state verification to `.devcontainer/scripts/health-check.sh` checking if databases exist and have tables
- [x] T053 [US3] Update `docs/dev-setup-devcontainer.md` with database management section explaining persistence, volume locations, reset commands, and seed profiles
- [x] T054 [US3] Add troubleshooting entry to `docs/dev-setup-devcontainer.md` for database corruption with volume deletion steps

**Checkpoint**: Database persistence working, reset commands functional, seed profiles configurable

---

## Phase 6: User Story 4 - Service Configuration and Customization (Priority: P3)

**Goal**: Developers can enable/disable specific microservices via configuration, with minimal mode auto-detected for low RAM

**Independent Test**: Set ENABLED_SERVICES environment variable to exclude events/statutory/discounts, restart container, verify only frontend and core start. Test auto-detection by limiting Docker Desktop RAM to 5GB, verify minimal mode prompt appears.

### Implementation for User Story 4

- [x] T055 [US4] Add RAM detection function to `.devcontainer/scripts/utils.sh` using free -g command and returning available RAM in GB
- [x] T056 [US4] Implement minimal mode prompt in `.devcontainer/scripts/post-start.sh` that triggers when available RAM < 6GB (but >= 4GB)
- [x] T057 [US4] Add minimal mode prompt display in `.devcontainer/scripts/post-start.sh` explaining what's included/excluded and asking Y/n with 10-second timeout defaulting to Y
- [x] T058 [US4] Implement ENABLED_SERVICES environment variable parsing in `.devcontainer/scripts/post-start.sh` to control which services start
- [x] T059 [US4] Add minimal mode service list to `.devcontainer/scripts/post-start.sh` setting ENABLED_SERVICES="core:frontend" when minimal mode accepted
- [x] T060 [US4] Update service startup logic in `.devcontainer/scripts/post-start.sh` to skip services not in ENABLED_SERVICES with clear "skipped" messages
- [x] T061 [US4] Add insufficient RAM error handling to `.devcontainer/scripts/post-start.sh` when available RAM < 4GB with recommendations (close apps, increase Docker memory)
- [x] T062 [US4] Update `.devcontainer/scripts/post-start.sh` to display which services are enabled/disabled in startup message
- [x] T063 [US4] Add service state messages to `.devcontainer/scripts/post-start.sh` when accessing disabled services showing clear "Service disabled in minimal mode" messages
- [x] T064 [US4] Create `.env.example` at repository root documenting ENABLED_SERVICES variable with examples (full mode, minimal mode, custom combinations)
- [x] T065 [US4] Update `docs/dev-setup-devcontainer.md` with minimal mode section explaining triggers, included services, how to enable/disable services manually
- [x] T066 [US4] Add troubleshooting entry to `docs/dev-setup-devcontainer.md` for switching between minimal and full mode (update ENABLED_SERVICES, rebuild container)

**Checkpoint**: All user stories should now be independently functional - local dev containers, Codespaces, database persistence, and service configuration

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [x] T067 [P] Add detailed comments to `.devcontainer/devcontainer.json` explaining each section and why certain configurations are chosen
- [x] T068 [P] Add detailed comments to `.devcontainer/docker-compose.devcontainer.yml` explaining service configurations and health checks
- [x] T069 [P] Create `.devcontainer/scripts/README.md` documenting all scripts, their purposes, and how they're called
- [x] T070 [P] Optimize `.devcontainer/Dockerfile` layer ordering for better caching (static installs first, changing content last)
- [x] T071 Add `.devcontainer/scripts/validate-setup.sh` script that checks all prerequisites (Docker version, available RAM, disk space) before starting
- [x] T072 Integrate validate-setup.sh into post-create.sh as first step with clear pass/fail reporting
- [x] T073 Update `README.md` to preserve Vagrant setup documentation in separate section, marking dev containers as recommended but optional
- [x] T074 Create `docs/dev-setup-vagrant.md` by moving Vagrant-specific instructions from README.md (maintain backward compatibility per FR-014)
- [x] T075 Add comparison table to `README.md` showing Vagrant vs Dev Container differences (setup time, prerequisites, URLs, memory usage)
- [x] T076 [P] Add shell completion sources to `.devcontainer/scripts/post-create.sh` for docker and docker-compose commands
- [x] T077 [P] Add VS Code settings to `.devcontainer/devcontainer.json` for terminal (default profile: bash, scroll back limit)
- [x] T078 Create `docs/troubleshooting-devcontainer.md` consolidating all troubleshooting scenarios with search-friendly headers (port conflicts, memory issues, build failures, health check failures)
- [x] T079 Add startup timing measurement to `.devcontainer/scripts/post-start.sh` displaying total time from start to "ready" message
- [x] T080 Validate startup timing meets SC-004 requirement (all services healthy within 2 minutes)
- [x] T081 Test hot-reload timing meets SC-005 requirement (changes visible within 3 seconds)
- [x] T082 Test full mode memory usage meets SC-009 requirement (<4GB RAM)
- [x] T083 Test minimal mode memory usage meets SC-009 requirement (<2GB RAM)
- [ ] T084 Run full quickstart.md validation on Windows host
- [ ] T085 Run full quickstart.md validation on macOS host
- [ ] T086 Run full quickstart.md validation on Linux host
- [ ] T087 Run full quickstart.md validation in GitHub Codespaces
- [ ] T088 Verify all edge cases from spec.md: port conflicts, Vagrant coexistence, Docker not running, network issues, disk space, multiple Codespaces
- [x] T089 Update `.github/copilot-instructions.md` with dev container best practices and common patterns (if not already updated by update-agent-context.sh)
- [x] T090 Create `CHANGELOG.md` entry documenting the new dev container setup as alternative to Vagrant

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion - MVP story, highest priority
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion - Can proceed in parallel with US1 if separate developer
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) completion - Can proceed in parallel with US1/US2 if separate developer
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2) completion - Can proceed in parallel with other stories if separate developer
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: INDEPENDENT - Can start after Foundational, no dependencies on other stories, forms MVP
- **User Story 2 (P2)**: INDEPENDENT - Can start after Foundational, builds on US1 config but testable independently (Codespaces vs local)
- **User Story 3 (P3)**: INDEPENDENT - Can start after Foundational, adds persistence features, testable independently
- **User Story 4 (P3)**: INDEPENDENT - Can start after Foundational, adds resource adaptation, testable independently

### Within Each User Story

- US1: devcontainer.json → docker-compose overrides → post-create script → post-start script → health checks → documentation
- US2: Codespaces workflow → environment detection → URL display → documentation
- US3: Volume verification → reset commands → seed profiles → documentation
- US4: RAM detection → minimal mode logic → service filtering → documentation

### Parallel Opportunities

**Within Setup (Phase 1)**:

- T004, T005 can run in parallel (different files)

**Within Foundational (Phase 2)**:

- T006, T007, T008, T009 can run in parallel (different files)
- T010 can run in parallel with others

**Within User Story 1 (Phase 3)**:

- T016, T017, T018 (events, statutory, discounts service configs) can run in parallel
- T019, T020, T021 (traefik, portainer, pgadmin configs) can run in parallel

**Across User Stories (if team capacity allows)**:

- User Story 1, 2, 3, 4 can all proceed in parallel after Foundational phase completes
- Recommended: Complete US1 first as MVP, then parallelize US2, US3, US4

**Within Polish (Phase 7)**:

- T067, T068, T069, T070, T076, T077 (documentation and optimization) can run in parallel
- T084, T085, T086, T087 (platform validation) can run in parallel if multiple test machines available

---

## Parallel Example: User Story 1 Service Configurations

```bash
# Launch all service override configurations together:
Task T016: "Add events API service override to docker-compose.devcontainer.yml"
Task T017: "Add statutory API service override to docker-compose.devcontainer.yml"
Task T018: "Add discounts API service override to docker-compose.devcontainer.yml"
Task T019: "Add traefik service override to docker-compose.devcontainer.yml"
Task T020: "Add portainer service override to docker-compose.devcontainer.yml"
Task T021: "Add pgadmin service override to docker-compose.devcontainer.yml"

# These can all be done simultaneously as they modify different sections
# of the same file without conflicts (each service is independent YAML block)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005) - ~30 minutes
2. Complete Phase 2: Foundational (T006-T010) - ~1 hour
3. Complete Phase 3: User Story 1 (T011-T035) - ~6-8 hours
4. **STOP and VALIDATE**: Test on all three platforms (Windows, macOS, Linux)
5. **Deploy/Demo**: Developers can now use dev containers for local development
6. **Success Criteria Validation**:
   - SC-001: Setup time <5 minutes? ✓
   - SC-002: Build time <15 minutes? ✓
   - SC-003: 95% first-attempt success? ✓
   - SC-004: Services healthy <2 minutes? ✓
   - SC-005: Hot-reload <3 seconds? ✓

### Incremental Delivery

1. **Day 1-2**: Setup + Foundational → Foundation ready
2. **Day 3-4**: Add User Story 1 → Test independently → **Deploy MVP** (local dev containers working!)
3. **Day 5**: Add User Story 2 → Test independently → Deploy (Codespaces support added)
4. **Day 6**: Add User Story 3 → Test independently → Deploy (database persistence enhanced)
5. **Day 7**: Add User Story 4 → Test independently → Deploy (resource adaptation working)
6. **Day 8**: Polish & validation → All platforms tested → **Feature complete**

Each story adds value without breaking previous stories. Can stop after any story if priorities change.

### Parallel Team Strategy

With 3-4 developers after Foundational phase completes:

1. **Developer A**: User Story 1 (MVP) - Core local dev container setup
2. **Developer B**: User Story 2 (Codespaces) - Can start immediately after Foundational
3. **Developer C**: User Story 3 (Persistence) - Can start immediately after Foundational
4. **Developer D**: User Story 4 (Configuration) - Can start immediately after Foundational

All stories integrate independently and test independently. Team can deliver all 4 stories in parallel within 2-3 days.

---

## Task Summary

**Total Tasks**: 97 (updated to include all 12 services)

- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 5 tasks (BLOCKING)
- Phase 3 (User Story 1 - P1 MVP): 32 tasks ⭐ **Recommended MVP scope** (includes all services)
- Phase 4 (User Story 2 - P2): 8 tasks
- Phase 5 (User Story 3 - P3): 11 tasks
- Phase 6 (User Story 4 - P3): 12 tasks
- Phase 7 (Polish): 24 tasks

**Parallel Opportunities**: ~35 tasks marked [P] can run in parallel

**Independent User Stories**: 4 stories, all independently implementable and testable

**Suggested MVP Scope**: Phases 1, 2, and 3 (42 tasks) - Delivers local dev container setup with ALL 12 services, the complete value proposition

**Estimated Timeline**:

- MVP only (Phases 1-3): 3-4 days (includes all 12 services)
- All user stories: 6-9 days
- Including polish and validation: 9-11 days

**Success Validation Required**:

- Build time <15 minutes (SC-002)
- Startup time <2 minutes (SC-004)
- Hot-reload <3 seconds (SC-005)
- Memory usage <4GB full mode (SC-009)
- Memory usage <2GB minimal mode (SC-009)
- Test on Windows, macOS, Linux (SC-003)
- Test in GitHub Codespaces (SC-007)

---

## Notes

- [P] tasks = different files or independent sections, no dependencies
- [US#] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- MVP (User Story 1) delivers core value - local dev container setup
- Stories 2-4 are enhancements that can be added incrementally
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths are relative to repository root
- Scripts use bash (cross-platform via Git Bash on Windows)
- Health checks critical for reliability - test thoroughly
- Resource detection (US4) should gracefully handle edge cases

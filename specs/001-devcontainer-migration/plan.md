# Implementation Plan: Dev Container Migration

**Branch**: `001-devcontainer-migration` | **Date**: 2025-10-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-devcontainer-migration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Replace Vagrant-based development setup with VS Code Dev Containers and GitHub Codespaces support. Developers will access services via localhost ports (local dev) or GitHub port forwarding (Codespaces) instead of subdomain-based URLs. All services start automatically with health checks and dependency ordering. The system adapts to resource-constrained machines by offering minimal service mode. This maintains Docker-first development while reducing setup overhead from 20-25 minutes to under 5 minutes.

## Technical Context

**Language/Version**: Shell scripting (Bash), YAML/JSON (devcontainer.json, docker-compose.yml)
**Primary Dependencies**: Docker Engine/Desktop, VS Code Dev Containers extension, docker-compose, existing MyAEGEE docker infrastructure
**Storage**: Docker volumes for PostgreSQL databases (existing: postgres-core, postgres-events, postgres-statutory, postgres-discounts, postgres-summeruniversity, postgres-network, postgres-knowledge)
**Testing**: Manual testing of container builds, service startup, port accessibility; automated health checks
**Target Platform**: VS Code on Windows/macOS/Linux (local), GitHub Codespaces (cloud)
**Project Type**: Infrastructure/DevOps - modifies development environment setup, not application code
**Performance Goals**: Container build <15 min, startup <2 min for all services, hot-reload <3 sec
**Constraints**: Memory <4GB full mode / <2GB minimal mode, backward compatible with Vagrant setup
**Scale/Scope**: 12 services total (8 backend microservices: core, events, statutory, discounts, summeruniversity, network, knowledge, mailer; 1 frontend; 3 infrastructure: gateways, gsuite-wrapper, dev-tools), ~20 containers total including databases and admin tools

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                  | Compliance Status | Notes                                                                                               |
| ------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------- |
| **I. Microservices Architecture**          | ✅ PASS           | Feature preserves existing microservices architecture; only changes how dev environment starts them |
| **II. Docker-First Development**           | ✅ PASS           | Enhances Docker-first approach by removing Vagrant layer; maintains docker-compose orchestration    |
| **III. User Story-Driven Development**     | ✅ PASS           | Spec includes 4 prioritized user stories (P1-P3) with independent test criteria                     |
| **IV. API Contract Testing**               | ✅ PASS           | Feature doesn't modify inter-service contracts; maintains existing API behavior                     |
| **V. Observability and Monitoring**        | ✅ PASS           | Preserves existing health checks, logging, and monitoring; adds startup health check validation     |
| **VI. Database Migrations and Versioning** | ✅ PASS           | Maintains existing migration approach; seeds run automatically on first start                       |
| **VII. Semantic Versioning**               | ✅ PASS           | Feature is infrastructure change; services maintain their own versioning                            |
| **Technology Stack**                       | ✅ PASS           | Uses existing Docker/docker-compose infrastructure; no service code changes                         |
| **Service Structure Standards**            | ✅ PASS           | No changes to service directory structures                                                          |
| **Environment Configuration**              | ✅ PASS           | Maintains .env file approach; auto-configures for localhost ports                                   |
| **Development Workflow**                   | ⚠️ PARTIAL        | Updates local development setup; Vagrant workflow remains available for compatibility               |
| **Quality Gates**                          | ✅ PASS           | Testing focuses on container build, service health, and accessibility                               |

**Gate Decision**: ✅ PASS - Feature aligns with all constitution principles and enhances Docker-first development

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# New dev container configuration
.devcontainer/
├── devcontainer.json           # VS Code dev container config
├── docker-compose.devcontainer.yml  # Service orchestration for dev containers
├── Dockerfile                  # Base dev container image
└── scripts/
    ├── post-create.sh         # Runs after container created
    ├── post-start.sh          # Runs on container start
    └── health-check.sh        # Service health validation

# Updated documentation
README.md                       # Updated with dev container setup instructions
docs/
├── dev-setup-devcontainer.md  # New: Dev container setup guide
└── dev-setup-vagrant.md       # Existing: Vagrant setup (maintained for compatibility)

# Existing structure (unchanged)
core/                          # Core microservice (Node.js + PostgreSQL)
events/                        # Events microservice (Node.js + PostgreSQL)
statutory/                     # Statutory microservice (Node.js + PostgreSQL)
discounts/                     # Discounts microservice (Node.js + PostgreSQL)
summeruniversity/             # Summer University microservice (Node.js + PostgreSQL)
network/                       # Network microservice (Node.js + PostgreSQL)
knowledge/                     # Knowledge base microservice (Node.js + PostgreSQL)
mailer/                        # Mailer service (Elixir/Phoenix)
frontend/                      # Vue.js frontend (SPA)
gateways/                      # API gateway and routing (Traefik + Portal)
gsuite-wrapper/               # GSuite integration service (Node.js)
dev-tools/                    # Development tools (admin interfaces)
base-docker-compose.yml       # Base service definitions
.env                          # Environment configuration
Makefile                      # Build commands (used in dev container)
helper.sh                     # Container management script
```

**Structure Decision**: Infrastructure change pattern - adds `.devcontainer/` directory with dev container configuration files while preserving existing Vagrant and docker-compose setup. No modifications to service code or structure. The devcontainer.json references existing docker-compose infrastructure.

## Complexity Tracking

_No constitution violations - all checks passed. This section intentionally left minimal._

This feature enhances the existing Docker-first development principle without introducing complexity. The dev container approach simplifies (rather than complicates) the development setup by removing the Vagrant VM layer while preserving all microservices architecture principles.

---

## Phase Completion Summary

### ✅ Phase 0: Research (Complete)

**Artifacts Created**:

- `research.md` - 10 technical decisions documented with rationale
  - Dev container base image selection
  - Service orchestration strategy
  - Port mapping strategy (localhost:3000+)
  - Dependency startup ordering approach
  - Database persistence with Docker volumes
  - Resource adaptation (minimal mode)
  - Configuration management (auto-generated .env)
  - GitHub Codespaces optimization
  - Hot reload support
  - Backward compatibility with Vagrant

**Key Findings**:

- Use official Microsoft dev container base images
- Leverage existing docker-compose infrastructure
- Map to non-privileged ports (3000, 8080+)
- Implement health checks with depends_on
- Auto-detect RAM and offer minimal mode for constrained systems

### ✅ Phase 1: Design & Contracts (Complete)

**Artifacts Created**:

- `data-model.md` - Configuration entities and state machines
  - DevContainer configuration schema
  - Service configuration with health checks
  - Environment variable management
  - Volume persistence model
  - Service startup state machine
- `contracts/startup-contract.md` - Startup behavior specification
  - Post-create and post-start outputs
  - Health check requirements
  - Error handling contracts
  - Minimal mode behavior
  - Testing checklist
- `quickstart.md` - Developer onboarding guide
  - 5-minute setup instructions
  - Service URL reference
  - Common commands
  - Troubleshooting guide
  - Comparison with Vagrant

**Agent Context Updated**:

- ✅ `.github/copilot-instructions.md` updated with:
  - Shell scripting (Bash) for dev container scripts
  - YAML/JSON for devcontainer.json and docker-compose
  - Docker infrastructure knowledge
  - PostgreSQL database volumes

### 📋 Phase 2: Task Breakdown (Next Step)

**Status**: Ready to proceed with `/speckit.tasks`

This phase will break down the implementation into concrete tasks organized by user story priority. The task breakdown will reference the design artifacts created in Phase 1.

---

## Next Steps

1. **Run `/speckit.tasks`** to generate task breakdown in `tasks.md`
2. **Begin implementation** following P1 user story (Local Development Setup)
3. **Test on all platforms** (Windows, macOS, Linux)
4. **Validate in GitHub Codespaces**
5. **Update documentation** as implementation progresses

---

## References

- **Specification**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Startup Contract**: [contracts/startup-contract.md](./contracts/startup-contract.md)
- **Developer Guide**: [quickstart.md](./quickstart.md)

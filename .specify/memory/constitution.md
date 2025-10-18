# MyAEGEE Online Membership System Constitution

<!--
Sync Impact Report:
- Version change: INITIAL → 1.0.0
- Initial constitution creation for MyAEGEE (AEGEE-Europe's OMS)
- Established 7 core principles based on existing project practices
- Added Development Workflow and Quality Standards sections
- Templates requiring updates:
  ✅ plan-template.md - Aligned with microservices architecture principle
  ✅ spec-template.md - Aligned with testing and Docker requirements
  ✅ tasks-template.md - Aligned with modular development approach
- Follow-up TODOs: None - all placeholders filled with project-specific content
-->

## Core Principles

### I. Microservices Architecture (NON-NEGOTIABLE)

The system MUST be composed of independent, loosely-coupled microservices. Each microservice:

- Operates in its own Docker container with isolated dependencies
- Maintains its own database (no shared databases between services)
- Communicates via HTTP/REST APIs through the core authentication service
- Can be developed, tested, deployed, and scaled independently
- MUST provide its own `docker-compose.yml` and `docker-compose.dev.yml` files

**Rationale**: Enables parallel development by distributed teams, reduces system-wide failures, allows technology flexibility per service, and facilitates incremental updates.

### II. Docker-First Development

ALL components MUST run in Docker containers. Development environment MUST mirror production.

- Vagrant + VirtualBox provides consistent development VM across platforms
- Docker Compose orchestrates multi-container applications
- Helper scripts (`helper.sh`, `Makefile`) abstract Docker complexity
- Environment configuration centralized in `.env` file
- NO direct host system dependencies beyond Docker/Vagrant tooling

**Rationale**: Eliminates "works on my machine" problems, ensures parity between development and production, simplifies onboarding for new contributors.

### III. Test-Driven Quality (NON-NEGOTIABLE)

Every microservice MUST maintain comprehensive automated tests:

- Unit tests for business logic (minimum 70% coverage)
- Integration tests for API contracts and database interactions
- E2E tests for critical user journeys (frontend)
- Linting enforced (ESLint for JavaScript, yamllint for YAML, hadolint for Dockerfiles)
- CI/CD pipeline MUST run all tests before merge (CircleCI configured)
- Tests MUST be runnable locally via `npm test` or equivalent

**Rationale**: Prevents regressions in distributed microservices environment, enables confident refactoring, documents expected behavior.

### IV. Traefik-Routed Service Discovery

All HTTP traffic MUST be routed through Traefik reverse proxy:

- Services declare their routing rules via Docker labels
- Subdomain-based routing (e.g., `my.appserver.test`, `traefik.appserver.test`)
- No direct port exposure except Traefik's entry points
- SSL termination handled at Traefik layer (production)
- Service URLs configurable via `.env` variables

**Rationale**: Provides single entry point, enables dynamic service discovery, simplifies SSL management, allows zero-downtime deployments.

### V. Configuration via Environment

ALL runtime configuration MUST be externalized to environment variables:

- `.env` file defines all service URLs, enabled services, credentials
- Secrets stored in `secrets/` directory (git-ignored)
- `ENABLED_SERVICES` controls which microservices are activated
- `MYAEGEE_ENV` switches between development/production modes
- NO hardcoded URLs, passwords, or environment-specific values in code

**Rationale**: Enables 12-factor app principles, prevents credential leaks, allows same codebase across environments, simplifies configuration management.

### VI. Modular Service Structure

Each microservice repository MUST follow standard structure:

- `/lib` - Core application code
- `/models` - Database models (Sequelize ORM for Node.js services)
- `/migrations` - Database schema migrations
- `/test` - Automated tests
- `/docker` - Docker configuration files
- `/config` - Environment-specific configuration loaders
- `package.json` - Dependencies and npm scripts (Node.js services)
- `README.md` - Service-specific documentation

**Rationale**: Reduces cognitive load when switching between services, enables tooling consistency, facilitates code reviews across repositories.

### VII. Git Submodules for Service Composition

The main repository (`MyAEGEE`) MUST use git submodules for each microservice:

- Each service maintained in separate GitHub repository
- `git clone --recursive` ensures all services are cloned
- `make bump` updates all submodules to latest stable versions
- Submodule commits pinned for reproducible builds
- Service-specific changes committed to service repo, then updated in main repo

**Rationale**: Enables independent service versioning, allows service-specific access control, maintains clear ownership boundaries, supports modular CI/CD.

## Development Workflow

### Branch and Release Management

- `stable` branch represents production-ready code
- Feature development in feature branches, merged via pull requests
- Semantic versioning for service releases (MAJOR.MINOR.PATCH)
- Automated releases via `semantic-release` (configured in CircleCI)
- Breaking changes MUST bump MAJOR version and include migration guide

### Code Review Requirements

- All changes MUST pass automated CI checks (tests, linting, security audit)
- At least one approving review required for merge
- Review focuses on: functionality, test coverage, security implications, performance
- CircleCI Slack notifications alert team of failures

### Local Development Cycle

1. Clone with `git clone --recursive https://github.com/AEGEE/MyAEGEE.git`
2. Run `./start.sh` to bootstrap Vagrant VM with all services
3. Edit code in host machine (files mounted into VM at `/vagrant`)
4. Use `make monitor` to view logs, `make restart` to apply changes
5. Run tests locally before pushing (`npm test` in service directory)
6. Update submodules with `make bump` when dependencies change

## Quality Standards

### Performance

- API response times MUST be < 500ms for 95th percentile
- Database queries optimized with proper indexing
- Frontend bundle size monitored, code-splitting encouraged
- Docker images kept minimal (alpine-based where possible)

### Security

- NO credentials in git history (use `secrets/` directory)
- NPM security audits run in CI (`npm audit --production`)
- User passwords hashed with bcrypt (minimum 10 salt rounds)
- Core service provides JWT-based authentication for all microservices
- HTTPS enforced in production (Traefik handles SSL)

### Observability

- Structured logging to stdout (Docker collects logs)
- Log levels configurable via environment (`LOG_LEVEL`)
- Development mode enables verbose logging for debugging
- Traefik dashboard provides service health overview (`traefik.appserver.test`)
- Portainer available in development for container management

### Documentation

- README.md required in every microservice repository
- API documentation via apiary.apib (see `events/apiary.apib` example)
- Inline code comments for complex business logic
- Confluence wiki for architecture decisions and guides (https://myaegee.atlassian.net)
- Changelog maintained in CHANGELOG.md (automatically updated by semantic-release)

## Governance

This constitution supersedes all other development practices. All code changes, architectural decisions, and process improvements MUST align with these principles.

**Amendment Process**:

1. Propose changes via pull request to `.specify/memory/constitution.md`
2. Justify amendment with rationale (backward compatibility, technical debt, new requirements)
3. Review by maintainers and core contributors
4. Version bump according to semantic rules (MAJOR for breaking changes, MINOR for additions)
5. Update dependent templates and documentation in same PR
6. Announce changes to development team via Confluence and GitHub

**Compliance Verification**:

- All pull requests MUST include constitution compliance checklist
- CI pipeline enforces technical requirements (tests, linting, Docker structure)
- Code reviews verify adherence to principles
- Quarterly architecture reviews assess systemic compliance

**Exceptions**:

- Temporary deviations permitted for urgent production fixes (MUST be documented in commit message)
- Technical debt MUST be tracked in JIRA (https://myaegee.atlassian.net/projects/MEMB)
- Exception rationale and remediation plan required for approval

**Version**: 1.0.0 | **Ratified**: 2025-10-18 | **Last Amended**: 2025-10-18

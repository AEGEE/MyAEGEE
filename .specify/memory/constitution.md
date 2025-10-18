<!--
SYNC IMPACT REPORT
==================
Version Change: Initial (template) → 1.0.0
Modified Principles: All principles defined for first time
Added Sections: Core Principles, Architecture Standards, Development Workflow, Governance
Removed Sections: None (first version)
Templates Status:
  ✅ plan-template.md - reviewed, no constitution-specific references to update
  ✅ spec-template.md - reviewed, aligns with user-first principle
  ✅ tasks-template.md - reviewed, aligns with incremental delivery principle
  ⚠ agent-file-template.md - pending review for technology stack alignment
  ⚠ checklist-template.md - pending review for quality gate alignment
Follow-up TODOs: None - all placeholders filled
==================
-->

# MyAEGEE Constitution

## Core Principles

### I. Microservices Architecture

Each service MUST be independently deployable, maintainable, and testable. Services communicate via
well-defined REST APIs with clear contracts. Each microservice owns its data and database, avoiding
shared databases between services. Services MUST provide health check endpoints and expose metrics
for monitoring.

**Rationale**: The MyAEGEE system consists of multiple independent services (core, events,
statutory, discounts, knowledge, etc.). This architecture enables teams to work independently,
deploy services without coordinating releases, and scale components based on specific load
requirements.

### II. Docker-First Development

All services MUST run in Docker containers with docker-compose orchestration for local development.
Development and production environments MUST use the same containerized approach to ensure
consistency. Configuration MUST be externalized via environment variables defined in `.env` files.
Dockerfile and docker-compose files MUST be maintained in each service's `docker/` directory.

**Rationale**: Docker ensures "works on my machine" problems are eliminated. The project uses Vagrant
to provision a consistent development VM with Docker, making onboarding straightforward and
environment-related issues minimal.

### III. User Story-Driven Development

Features MUST be decomposed into independently deliverable user stories with clear priorities (P1, P2,
P3). Each user story MUST be independently testable and provide standalone value. Implementation MUST
follow priority order: P1 stories form the MVP, P2/P3 add incremental value. No work begins on lower
priority stories until higher priority stories are complete and validated.

**Rationale**: This ensures teams can deliver and demonstrate value incrementally. If development
stops at any point, the highest-value features are already complete and functional.

### IV. API Contract Testing

All inter-service communication MUST be governed by explicit contracts. When a service exposes an
API, contract tests MUST verify the API adheres to documented behavior. When service A depends on
service B's API, A MUST include contract tests verifying B's responses match expected schemas.
Contract changes MUST be versioned and backward compatible, or coordinated as breaking changes.

**Rationale**: With multiple microservices, integration failures are costly. Contract testing
catches breaking changes early and documents expected behavior for both API providers and consumers.

### V. Observability and Monitoring

All services MUST implement structured logging using Bunyan or equivalent. Services MUST expose
metrics via Prometheus endpoints for monitoring. Health check endpoints MUST be implemented at
`/healthcheck` or equivalent. Errors MUST be logged with sufficient context for debugging. For
production deployments, centralized logging (Kibana) and monitoring (Prometheus/Grafana) MUST be
configured.

**Rationale**: In a distributed microservices system, observability is critical. Without proper
logging and metrics, debugging production issues becomes impossible. The project already uses
Traefik, Portainer, and monitoring agents—services must integrate with this infrastructure.

### VI. Database Migrations and Versioning

Database schema changes MUST be implemented as migrations using Sequelize CLI (for Node.js services)
or equivalent tools. Migrations MUST be versioned, reversible, and tested. Migration scripts MUST
run automatically during container startup via `db:migrate` scripts. Seed data for development MUST
be separate from migrations and idempotent.

**Rationale**: Each microservice owns its database. Schema changes must be tracked, reproducible, and
safe. The core service already uses `db:setup`, `db:migrate`, and `db:seed` patterns—all services
must follow this standard.

### VII. Semantic Versioning and Release Management

All services MUST follow semantic versioning (MAJOR.MINOR.PATCH). Breaking changes increment MAJOR,
new features increment MINOR, bug fixes increment PATCH. Releases MUST be automated using semantic-
release with conventional commits. CHANGELOG.md MUST be automatically generated and maintained.
Breaking changes MUST be documented with migration guides.

**Rationale**: The project already uses semantic-release and commitlint for automated versioning.
This ensures consistent release practices across all services and clear communication of breaking
changes to dependent services and users.

## Architecture Standards

### Technology Stack

**Backend Services**: Node.js with Express framework, PostgreSQL databases, Sequelize ORM
**Frontend**: Vue.js 2.x with Vuex, Buefy UI components, Vue Router
**Infrastructure**: Docker, docker-compose, Traefik reverse proxy, Nginx for static assets
**Testing**: Jest for backend, Cypress for frontend E2E tests
**Monitoring**: Prometheus, Bugsnag for error tracking, Bunyan for logging
**CI/CD**: Conventional commits, semantic-release, commitlint, husky for git hooks

Services SHOULD use this stack unless there is a documented, justified reason for deviation (e.g.,
performance requirements, specialized functionality).

### Service Structure Standards

Each service MUST follow this directory structure:

```
service-name/
├── lib/           # Business logic and utilities
├── models/        # Database models (Sequelize)
├── migrations/    # Database migrations
├── test/          # Tests (unit, integration, contract)
├── middlewares/   # Express middlewares
├── config/        # Configuration files
├── docker/        # Dockerfile and docker-compose files
├── scripts/       # Seed data and utility scripts
├── package.json   # Dependencies and scripts
└── cli.js         # REPL CLI for manual operations
```

Frontend services MUST follow Vue CLI conventions with components, pages, store modules, and services
clearly separated.

### Environment Configuration

Services MUST read configuration from environment variables. Sensitive values (passwords, keys) MUST
be stored in the `secrets/` directory (gitignored). The top-level `.env` file defines global
configuration. Service-specific configuration MUST be in `service/docker/.env` files. Default values
MUST be provided for development; production deployments MUST override via environment-specific files.

## Development Workflow

### Feature Development Process

1. **Specification Phase**: Features start with a spec in `.specify/specs/[###-feature-name]/spec.md`
   defining user stories, requirements, and success criteria
2. **Planning Phase**: Technical plan created in `plan.md` covering architecture, structure, and
   constitution compliance
3. **Task Breakdown**: Tasks generated in `tasks.md` organized by user story priority
4. **Implementation Phase**: TDD approach—write tests first (failing), implement, verify tests pass
5. **Integration Phase**: Test service independently, then integration with dependent services
6. **Review Phase**: Code review verifying constitution compliance, test coverage, documentation

### Quality Gates

Before merging to main branch:

- All tests MUST pass (unit, integration, contract as applicable)
- Linting MUST pass (ESLint with Airbnb config)
- Code coverage MUST meet thresholds (defined per service)
- Documentation MUST be updated (README, API docs, CHANGELOG)
- Constitution compliance MUST be verified (microservices principles, observability, etc.)

### Local Development Standards

Developers MUST use the provided Vagrant/Docker setup to ensure environment consistency. Developers
SHOULD edit code on the host machine (with IDE/editor of choice) leveraging mounted volumes. The
`make` commands on the guest VM MUST be used for building, starting, and managing services. The
`helper.sh` script MUST be used for container operations (logs, execute commands).

## Governance

This constitution supersedes all other development practices and guidelines. All pull requests,
design decisions, and code reviews MUST verify compliance with these principles. Deviations MUST be
explicitly justified in a "Complexity Tracking" section of the implementation plan, documenting why
simpler alternatives were rejected.

### Amendment Process

Constitution amendments require:

1. Proposed changes documented with rationale and impact analysis
2. Review by project maintainers
3. Migration plan for existing code if principles change
4. Update of dependent artifacts (templates, prompts, guidance docs)
5. Version increment following semantic versioning for governance documents

### Compliance Review

Feature plans MUST include a "Constitution Check" section verifying adherence to principles. During
code review, reviewers MUST verify:

- Microservices principles (independent deployment, own database, health checks)
- Docker configuration present and functional
- Tests present and passing (contract tests for APIs)
- Logging and monitoring instrumented
- Database migrations present and tested
- Semantic versioning followed

### Runtime Development Guidance

Active development guidelines and technology-specific patterns are maintained in
`.specify/templates/agent-file-template.md`, which is auto-generated from feature plans. This file
is updated as new technologies are adopted or patterns emerge, keeping runtime guidance current
without requiring constitution amendments.

**Version**: 1.0.0 | **Ratified**: 2025-10-18 | **Last Amended**: 2025-10-18

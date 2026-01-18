# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyAEGEE is the Online Membership System (OMS) for AEGEE-Europe, a student/youth association. It's a microservices-based application using Docker containers orchestrated via docker-compose, with Traefik as the reverse proxy.

## Architecture

**Microservices** (each is a git submodule with its own repository):
- **core** - User management, authentication, bodies/circles (Node.js/Express/Sequelize/PostgreSQL)
- **events** - Event management and applications
- **statutory** - Statutory events (Agora, EPM, etc.)
- **summeruniversity** - Summer University events
- **discounts** - Discount codes and partnerships
- **network** - Network/antenna management
- **knowledge** - Knowledge base
- **mailer** - Email service
- **gsuite-wrapper** - Google Suite integration
- **frontend** - Vue.js SPA (Buefy/Bulma)
- **gateways** - Traefik configuration and portal

**Infrastructure**:
- Docker Compose orchestrates all services
- Traefik v1.7 handles routing via labels in docker-compose files
- Each microservice has its own PostgreSQL database
- Vagrant/VirtualBox provides the development VM (optional but recommended)

## Common Commands

### Host Machine (start development environment)
```bash
./start.sh                    # Start with Vagrant VM
./start.sh --no-vagrant       # Start directly with Docker (Linux)
./start.sh --fast             # Production mode (no test data seeding)
./start.sh --reset            # Destroy and recreate VM
```

### Guest/Docker Machine (via `vagrant ssh` or directly if --no-vagrant)
```bash
make start                    # Start all enabled services
make build                    # Build containers
make bootstrap                # init + build + start (first run only)
make monitor                  # Follow all container logs
make live_refresh             # Rebuild and restart containers (CD target)
make bump                     # Update submodules to latest stable

./helper.sh --monitor core events    # Monitor specific containers
./helper.sh --execute core bash      # Execute command in container
```

### Individual Microservice Commands (run inside container or service directory)

**Backend services (core, events, statutory, discounts, network, summeruniversity, knowledge):**
```bash
npm test                      # Run tests (sets up test DB first)
npm run lint                  # Check code style (ESLint)
npm run lint:fix              # Auto-fix linting issues
npm run db:setup              # Drop/create/migrate database
npm run db:seed               # Seed test data
npm run db:recreate           # setup + seed
npm run db:clear              # Clear all data
npm run cli                   # Interactive REPL with models loaded

# Debug a single test file:
NODE_ENV=test npm run db:setup && ENABLE_LOGGING=1 npx jest <file.test.js> --runInBand --forceExit
```

**Frontend:**
```bash
npm run serve                 # Dev server with hot reload (localhost:8081)
npm run build                 # Production build to dist/
npm run lint                  # ESLint for .js and .vue files
npm run cypress:open          # Open Cypress test runner
npm run cypress:run           # Run Cypress tests headless
```

## Configuration

- `.env` - Main configuration file (copy from `.env.example`)
- `ENABLED_SERVICES` - Colon-separated list of services to run
- `MYAEGEE_ENV` - Either `development` or `production`
- Subdomains configured via `SUBDOMAIN_*` variables
- Development mode uses both `docker-compose.yml` and `docker-compose.dev.yml` per service

## URLs (development)

- http://my.appserver.test - Application frontend
- http://traefik.appserver.test - Traefik dashboard
- http://portainer.appserver.test - Container management
- http://pgadmin.appserver.test - Database admin

## Test Credentials

All test users have password: `5ecr3t5ecr3t`
- `admin@example.com` - Admin user
- `board@example.com` - Board member
- `member@example.com` - Regular member
- `suspended@example.com` - Suspended member

## Key Files

- `Makefile` - Build/run orchestration commands
- `helper.sh` - Shell wrapper for docker-compose operations
- `base-docker-compose.yml` - Base compose configuration
- `current-config.yml` - Generated full docker-compose config (for debugging)
- `secrets/` - Auto-generated secrets on first run
- Each service's `docker/docker-compose.yml` and `docker/docker-compose.dev.yml`

## Development Notes

- Services communicate via Docker's internal DNS (service name = hostname)
- All backend services expose port 8084 internally
- Frontend dist folder is mounted in dev mode for live updates
- Use EditorConfig plugin in your IDE to maintain consistent formatting
- Submodules track the `stable` branch

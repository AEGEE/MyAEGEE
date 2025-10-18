# NOTE: This file works in both Vagrant VM and direct Docker on Ubuntu environments
#  Commands automatically adapt based on the environment (detected by helper.sh)
#  - In Vagrant: Runs inside the VM after `vagrant ssh`
#  - On Ubuntu 24.04: Runs directly on the host with Docker

# TODO: are all commands idempotent??? (do i want them to be?)

include .env
export $(shell sed 's/=.*//' .env)

.PHONY: default init build start bootstrap bootstrap-ubuntu bootstrap_latest refresh live_refresh list debug config monitor stop down restart hard_restart \
        nuke_dev clean_docker_dangling_images clean_docker_images clean prune listen_frontend rebuild_frontend rebuild_core \
        rebuild_events rebuild_summeruniversity rebuild_statutory rebuild_discounts rebuild_mailer rebuild_network rebuild_knowledge \
        bump install-agents remove-agents backup backup_core backup_events backup_discounts backup_network backup_summeruniversity \
	    backup_knowledge backup_gsuite-wrapper backup_statping backup_statistics backup_security backup_shortener backup_survey \
	    dev full logs status

default:
	@echo 'Most common options are bootstrap, start, monitor, live_refresh, restart, nuke_dev, clean (cleans untagged/unnamed images)'
	@echo ''
	@echo 'For initial setup:'
	@echo '  - Ubuntu 24.04: make bootstrap-ubuntu  (sets up Docker, then runs bootstrap)'
	@echo '  - Other systems: ./start.sh            (sets up Vagrant, then runs bootstrap)'
	@echo ''
	@echo 'Development commands:'
	@echo '  - make dev              Start minimal services (fast startup)'
	@echo '  - make full             Start all services'
	@echo '  - make logs service=X   Follow logs for service X'
	@echo '  - make status           Show running services'
	@echo ''

init: #check recursive & make secrets, change pw, change .env file
	./helper.sh -v --init

build: #docker-compose build
	./helper.sh -v --build

start: #docker-compose up -d
	./helper.sh --start

bootstrap: init build start

bootstrap_latest: init bump build start

bootstrap-ubuntu: #Ubuntu 24.04 direct Docker setup (no Vagrant)
	@if [ -x scripts-ubuntu/bootstrap.sh ]; then \
		scripts-ubuntu/bootstrap.sh; \
	else \
		echo "Error: scripts-ubuntu/bootstrap.sh not found or not executable"; \
		echo "This feature requires Ubuntu 24.04 LTS"; \
		exit 1; \
	fi

update: bump

refresh:  build

live_refresh:  # docker-compose up -d --build (CD TARGET)
	./helper.sh --refresh

list: #docker-compose ps
	./helper.sh -v --list

debug:
	./helper.sh -v --debug

config: debug

monitor: #by default it logs everything, to log some containers only, add the name
	./helper.sh --monitor

stop: # docker-compose stop
	./helper.sh --stop

down: # docker-compose down
	./helper.sh --down

restart:
	./helper.sh --down

hard_restart: nuke_dev restart

nuke_dev:   #docker-compose down -v #TODO if needed: make this nuke take into account the .env like in deploy
	./helper.sh --nuke

diagnostics:
	/vagrant/scripts-vagrant_provision/diagnostics.sh

# Cleanup
clean_docker_dangling_images:
	docker rmi $(shell docker images -qf "dangling=true")

clean_docker_images:
	docker rmi $(shell docker images -q)

clean: clean_docker_images clean_docker_dangling_images

prune: clean
	docker system prune

###How to remove all containers:
#  docker rm $(docker ps -aq)
###How to kill/stop and remove all containers:
#  docker rm $(docker {kill|stop} $(docker ps -aq))

# Development
listen_frontend:
	cd frontend && npm run build -- --watch

rebuild_frontend:
	#TODO: npx vue-cli-service build && chmod 775 -R dist && docker restart myaegee_frontend_1
	#FIXME: below
	./helper.sh --docker -- up -d --build --force-recreate frontend

rebuild_core:
	./helper.sh --docker -- up -d --build --force-recreate core

rebuild_events:
	./helper.sh --docker -- up -d --build --force-recreate events

rebuild_statutory:
	./helper.sh --docker -- up -d --build --force-recreate statutory

rebuild_discounts:
	./helper.sh --docker -- up -d --build --force-recreate discounts

rebuild_mailer:
	./helper.sh --docker -- up -d --build --force-recreate mailer

rebuild_network:
	./helper.sh --docker -- up -d --build --force-recreate network

rebuild_summeruniversity:
	./helper.sh --docker -- up -d --build --force-recreate summeruniversity

rebuild_knowledge:
	./helper.sh --docker -- up -d --build --force-recreate knowledge

bump_and_commit:
	./helper.sh --bump $(module) #FIXME it is missing something (like variable declaration)

bump:
	./helper.sh --bumpmodules

# Monitors
install-agents:
	docker-compose -f gateways/docker/docker-compose.yml -f monitor-agents/docker/docker-compose.yml up -d

remove-agents:
	docker-compose -f monitor-agents/docker/docker-compose.yml down

# Backups
backup:
	./scripts-server/dump.sh postgres-core postgres-events postgres-statutory postgres-discounts postgres-network postgres-summeruniversity postgres-knowledge

backup_core:
	./scripts-server/dump.sh postgres-core

backup_events:
	./scripts-server/dump.sh postgres-events

backup_statutory:
	./scripts-server/dump.sh postgres-statutory

backup_discounts:
	./scripts-server/dump.sh postgres-discounts

backup_network:
	./scripts-server/dump.sh postgres-network

backup_summeruniversity:
	./scripts-server/dump.sh postgres-summeruniversity

backup_knowledge:
	./scripts-server/dump.sh postgres-knowledge

backup_gsuite-wrapper:
	echo "TODO: redis"

backup_statping:
	docker run --volumes-from=myaegee_statping_1 --entrypoint=/bin/bash nouchka/sqlite3 sqlite3 /app/statup.db ".backup '/app/statup.db.backup'" && docker cp myaegee_statping_1:/app/statup.db.backup "/opt/MyAEGEE/statup.db.backup-$(shell date +%Y-%m-%dT%H:%M)"

backup_statistics:
	echo "TODO: prometheus volume (not all of the data is important!)"

backup_security:
	./helper.sh --execute maria-bitwarden -- mysqldump -h"localhost" -u"warden" -p"$${PW_BITWARDEN}" bitwarden' > bitwarden_dump.sql.backup-$(shell date +%Y-%m-%dT%H:%M)

backup_shortener:
	./helper.sh --execute maria-yourls -- mysqldump -h"localhost" -u"yourls" -p"$${PW_YOURLS}" yourls' > yourls_dump.sql.backup-$(shell date +%Y-%m-%dT%H:%M)

backup_survey:
	./helper.sh --execute postgres-limesurvey -- pg_dump 'postgresql://postgres:$${PW_POSTGRES}@localhost/limesurvey' --inserts > limesurvey.sql.backup-$(shell date +%Y-%m-%dT%H:%M)

# Convenience commands for development
dev: # Start minimal development environment (fastest startup)
	@echo "🚀 Starting minimal development environment..."
	@echo "   Services: Traefik, Frontend, Core"
	@echo ""
	@if [ ! -f .env ]; then \
		echo "❌ Error: .env file not found"; \
		echo "   Run 'make init' or './start.sh' first"; \
		exit 1; \
	fi
	@# Temporarily override ENABLED_SERVICES for minimal setup
	@ENABLED_SERVICES=gateways:frontend:core ./helper.sh --start
	@echo ""
	@echo "✅ Minimal environment started!"
	@echo ""
	@echo "Access your services:"
	@echo "  Frontend:          http://my.appserver.test"
	@echo "  Traefik Dashboard: http://traefik.appserver.test"
	@echo ""
	@echo "To start more services, edit .env and run 'make start'"

full: # Start full development environment
	@echo "🚀 Starting full development environment..."
	@echo "   This may take 2-3 minutes..."
	@echo ""
	@if [ ! -f .env ]; then \
		echo "❌ Error: .env file not found"; \
		echo "   Run 'make init' or './start.sh' first"; \
		exit 1; \
	fi
	@# Start all common services
	@ENABLED_SERVICES=gateways:frontend:core:events:statutory:network:summeruniversity:discounts:mailer ./helper.sh --start
	@echo ""
	@echo "✅ Full environment started!"
	@echo ""
	@echo "Access your services:"
	@echo "  Frontend:          http://my.appserver.test"
	@echo "  Traefik Dashboard: http://traefik.appserver.test"
	@echo "  API Core:          http://my.appserver.test/api/core"
	@echo "  API Events:        http://my.appserver.test/api/events"
	@echo ""

logs: # Follow logs for a specific service (usage: make logs service=core)
	@if [ -z "$(service)" ]; then \
		echo "Usage: make logs service=<service_name>"; \
		echo ""; \
		echo "Examples:"; \
		echo "  make logs service=core"; \
		echo "  make logs service=frontend"; \
		echo "  make logs service=events"; \
		echo ""; \
		echo "To see all logs: make monitor"; \
		exit 1; \
	fi
	@echo "📋 Following logs for service: $(service)"
	@echo "   Press Ctrl+C to stop"
	@echo ""
	@./helper.sh --docker -- logs -f $(service) || docker-compose logs -f $(service)

status: # Show status of all running services
	@echo "📊 Service Status"
	@echo "=================="
	@echo ""
	@./helper.sh --list || docker-compose ps
	@echo ""
	@echo "Quick access URLs:"
	@echo "  Frontend:          http://my.appserver.test"
	@echo "  Traefik Dashboard: http://traefik.appserver.test"
	@echo ""
	@echo "To see logs: make monitor (all) or make logs service=<name> (specific)"


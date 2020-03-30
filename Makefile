# ARE ALL COMMANDS IDEMPOTENT??? (do i want them to be?)

include .env
export $(shell sed 's/=.*//' .env)

default:
	echo 'Most common options are bootstrap, start, monitor, live_refresh, restart, nuke_dev, clean (cleans untagged/unnamed images)'

init: #check recursive & make secrets, change pw, change .env file
	./helper.sh -v --init

build: #docker-compose build
	./helper.sh -v --build

start: #docker-compose up -d
	./helper.sh --start

bootstrap: init build start

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

# Cleanup
clean_docker_dangling_images:
	docker rmi $(docker images -qf "dangling=true")

clean_docker_images:
	docker rmi $(docker images -q)

clean: clean_docker_images clean_docker_dangling_images

prune: clean
	docker system prune -y

###How to remove all containers:
#  docker rm $(docker ps -aq)
###How to kill/stop and remove all containers:
#  docker rm $(docker {kill|stop} $(docker ps -aq))

# Development
listen_frontend:
	cd oms-frontend && npm run build -- --watch

rebuild_frontend:
	./helper.sh --docker -- up -d --build --force-recreate oms-frontend

rebuild_core:
	./helper.sh --docker -- up -d --build --force-recreate oms-core-elixir

rebuild_events:
	./helper.sh --docker -- up -d --build --force-recreate oms-events

rebuild_statutory:
	./helper.sh --docker -- up -d --build --force-recreate oms-statutory

rebuild_mailer:
	./helper.sh --docker -- up -d --build --force-recreate oms-mailer

bump:
	./helper.sh --bump

# Monitors
install-agents:
	docker-compose -f oms-global/docker/docker.compose.yml -f oms-monitor-agents/docker/docker-compose.yml up -d

remove-agents:
	docker-compose -f oms-monitor-agents/docker/docker-compose.yml down

# Backups
backup_core:
	bash ./helper.sh --execute postgres-oms-core-elixir -- pg_dump 'postgresql://postgres:$${PW_POSTGRES}@localhost/omscore_dev' --inserts > oms_core.sql.backup-$(date)

backup_events:
	bash ./helper.sh --execute postgres-oms-events -- pg_dump 'postgresql://postgres:$${PW_POSTGRES}@localhost/events' --inserts > oms_events.sql.backup-$(date)

backup_statutory:
	bash ./helper.sh --execute postgres-oms-statutory -- pg_dump 'postgresql://postgres:$${PW_POSTGRES}@localhost/statutory' --inserts > oms_statutory.sql.backup-$(date)

backup_discounts:
	bash ./helper.sh --execute postgres-oms-discounts -- pg_dump 'postgresql://postgres:$${PW_POSTGRES}@localhost/discounts' --inserts > oms_discounts.sql.backup-$(date)

backup_gsuite-wrapper:
	echo "TODO: redis"

backup_upmonitor:
	bash ./helper.sh --execute upmonitor -- sqlite3 /app/db/sqlite/production.sqlite3 ".backup '/app/db/sqlite/production.sqlite3.backup'" && docker cp myaegee_upmonitor_1:/app/db/sqlite/production.sqlite3.backup upmonitor.sqlite3.backup-$(date)

backup_statping:
	bash ./helper.sh --execute statping -- sqlite3 /app/statup.db ".backup '/app/statup.db.backup'" && docker cp myaegee_statping_1:/app/statup.db.backup statup.db.backup-$(date)

backup_statuspage:
	echo "who cares"

backup_statistics:
	echo "TODO: prometheus volume (not all of the data is important!)"

backup_security:
	bash ./helper.sh --execute maria-bitwarden -- mysqldump -h"localhost" -u"warden" -p"$${PW_BITWARDEN}" bitwarden' > bitwarden_dump.sql.backup-$(date)

backup_wiki:
	bash ./helper.sh --execute maria-mediawiki -- mysqldump -h"localhost" -u"wiki" -p"$${PW_MEDIAWIKI}" mediawiki' > mediawiki_dump.sql.backup-$(date)

backup_shortener:
	bash ./helper.sh --execute maria-yourls -- mysqldump -h"localhost" -u"yourls" -p"$${PW_YOURLS}" yourls' > yourls_dump.sql.backup-$(date)

backup_survey:
	bash ./helper.sh --execute postgres-limesurvey -- pg_dump 'postgresql://postgres:$${PW_POSTGRES}@localhost/limesurvey' --inserts > limesurvey.sql.backup-$(date)

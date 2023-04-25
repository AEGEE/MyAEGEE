
default: build-dev

build-dev:
	BASE_URL=appserver.vgr SUBDOMAIN_RABBITMQ=rabbit. SUBDOMAIN_MAILHOG=mailhog. PATH_DISPATCHER=./ COMPOSE_PROJECT_NAME=myaegee docker-compose -f ./docker/docker-compose.yml -f ./docker/docker-compose.dev.yml up -d

build:
	BASE_URL=appserver.vgr SUBDOMAIN_RABBITMQ=rabbit. COMPOSE_PROJECT_NAME=myaegee docker-compose -f ./docker/docker-compose.yml up -d

down:
	COMPOSE_PROJECT_NAME=myaegee docker-compose -f ./docker/docker-compose.yml -f ./docker/docker-compose.dev.yml down

test:
	@sed -i "s/'172.18.0.2'/$$(docker inspect myaegee_rabbit_1 | jq .[0].NetworkSettings.Networks.OMS.IPAddress)/" helpers/send.py ; cd helpers && python send.py


default: build-dev

build-dev:
	BASE_URL=appserver.vgr SUBDOMAIN_RABBITMQ=rabbit. SUBDOMAIN_MAILHOG=mailhog. PATH_DISPATCHER=./ COMPOSE_PROJECT_NAME=myaegee docker-compose -f ./docker/docker-compose.yml -f ./docker/docker-compose.dev.yml up -d

build:
	BASE_URL=appserver.vgr SUBDOMAIN_RABBITMQ=rabbit. COMPOSE_PROJECT_NAME=myaegee docker-compose -f ./docker/docker-compose.yml up -d

down:
	COMPOSE_PROJECT_NAME=myaegee docker-compose -f ./docker/docker-compose.yml -f ./docker/docker-compose.dev.yml down

test: build-dev
	@sleep 5; sed -i "s/'172.18.0.X'/$$(docker inspect myaegee_rabbit_1 | jq .[0].NetworkSettings.Networks.OMS.IPAddress)/" helpers/send.py ; cd helpers && python send.py

rabbit:
	@DOCKER_BUILDKIT=0 docker build -t aegee/rabbit:latest -f docker/Dockerfile.rabbit . && docker push aegee/rabbit

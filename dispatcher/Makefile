
COMPOSE_PROJECT_NAME ?= myaegee
#DOCKER_NETWORK ?= $(COMPOSE_PROJECT_NAME)_backend
DOCKER_NETWORK ?= backend

.PHONY: default build-dev build down test test-build rabbit help

default: build-dev

help:
	@echo "Available targets:"
	@echo "  build-dev   - Start dispatcher stack in development mode"
	@echo "  build       - Start dispatcher stack in production mode"
	@echo "  down        - Stop the dispatcher stack"
	@echo "  test-build  - Build the test container image"
	@echo "  test        - Run send.py to inject test messages into RabbitMQ"
	@echo "  rabbit      - Build and push the custom RabbitMQ image"

build-dev:
	BASE_URL=appserver.test \
	SUBDOMAIN_RABBITMQ=rabbit. \
	SUBDOMAIN_MAILPIT=mail. \
	PATH_DISPATCHER=./ \
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
	docker-compose -f ./docker/docker-compose.yml -f ./docker/docker-compose.dev.yml up -d

build:
	BASE_URL=appserver.test \
	SUBDOMAIN_RABBITMQ=rabbit. \
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
	docker-compose -f ./docker/docker-compose.yml up -d

down:
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
	docker-compose -f ./docker/docker-compose.yml -f ./docker/docker-compose.dev.yml down

test-build:
	docker build -t aegee/dispatcher-test:latest -f docker/Dockerfile.test .

test: test-build
	@echo "Injecting test messages into RabbitMQ..."
	docker run --rm -it \
		--network $(DOCKER_NETWORK) \
		-e RABBITMQ_HOST=rabbit \
		aegee/dispatcher-test:latest

rabbit:
	DOCKER_BUILDKIT=0 docker build -t aegee/rabbit:latest -f docker/Dockerfile.rabbit .
	docker tag aegee/rabbit:latest aegee/rabbit:3.13-mgmt-delayxch
	@echo "To push: docker push aegee/rabbit:latest && docker push aegee/rabbit:3.13-mgmt-delayxch"


COMPOSE_PROJECT_NAME ?= myaegee
#DOCKER_NETWORK ?= $(COMPOSE_PROJECT_NAME)_backend
DOCKER_NETWORK ?= backend

.PHONY: default build-dev build down test test-build lint format format-check help

default: build-dev

help:
	@echo "Available targets:"
	@echo "  build-dev     - Start dispatcher stack in development mode"
	@echo "  build         - Start dispatcher stack in production mode"
	@echo "  down          - Stop the dispatcher stack"
	@echo "  test-build    - Build the test container image"
	@echo "  test          - Run send.py to inject test messages into RabbitMQ"
	@echo "  lint          - Check Python code with ruff (requires: pip install ruff)"
	@echo "  format        - Auto-format Python code with ruff"
	@echo "  format-check  - Check formatting without making changes"

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

lint:
	ruff check .

format:
	ruff format .

format-check:
	ruff format --check .

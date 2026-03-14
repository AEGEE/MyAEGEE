#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="myaegee-shared-test-postgres"
IMAGE="postgres:10.18"
HOST_PORT="55433"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="5ecr3t"

wait_until_ready() {
  until docker exec "${CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" >/dev/null 2>&1; do
    sleep 1
  done
}

print_env() {
  cat <<EOF
export DB_HOST=127.0.0.1
export DB_PORT=${HOST_PORT}
export USERNAME=${POSTGRES_USER}
export PG_PASSWORD=${POSTGRES_PASSWORD}
EOF
}

case "${1:-start}" in
  start)
    if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
      docker start "${CONTAINER_NAME}" >/dev/null
    else
      docker run -d \
        --name "${CONTAINER_NAME}" \
        -e POSTGRES_USER="${POSTGRES_USER}" \
        -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
        -p "${HOST_PORT}:5432" \
        "${IMAGE}" >/dev/null
    fi

    wait_until_ready

    echo "Shared test Postgres is ready on localhost:${HOST_PORT}"
    print_env
    ;;
  stop)
    docker stop "${CONTAINER_NAME}"
    ;;
  rm)
    docker rm -f "${CONTAINER_NAME}"
    ;;
  status)
    docker ps -a --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}} {{.Status}}'
    ;;
  env)
    print_env
    ;;
  *)
    echo "Usage: $0 {start|stop|rm|status|env}" >&2
    exit 1
    ;;
esac

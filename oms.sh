#!/bin/bash

## This file gathers all docker-compose.yml files from [subfolders]/docker/docker-compose.yml and merges them with the -f option of the compose command.
## Instead of docker-compose up -d, write ./oms.sh up -d

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if ! [[ -f "$DIR/.env" ]]; then
    echo -e "[OMS] Copying .env file from .env.example"
    cp $DIR/.env.example $DIR/.env
fi

echo -e "[OMS] Creating OMS docker network"
docker network create OMS


## Declare docker-compose.yml folders
declare -a services=("oms-global" "oms-core")

command="docker-compose -f empty-docker-compose.yml"
for s in "${services[@]}"; do
    if [[ -f "$DIR/${s}/docker/docker-compose.yml" ]]; then
        command="${command} -f $DIR/${s}/docker/docker-compose.yml"
    fi
done

command="${command} ${@}"
echo -e "\n[OMS] Full command:\n${command}\n"
eval $command

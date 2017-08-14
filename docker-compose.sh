#!/bin/bash

## This file gathers all docker-compose.yml files from [subfolders]/docker/docker-compose.yml and merges them with the -f option of the compose command.
## Instead of docker-compose up -d, write ./docker-compose.sh up -d

command="docker-compose -f empty-docker-compose.yml" 

for d in */ ; do
    if [[ -f "${d}docker/docker-compose.yml" ]]; then
        command="${command} -f ${d}docker/docker-compose.yml"
    fi
done

command="${command} ${@}"
eval $command

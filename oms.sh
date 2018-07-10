#!/bin/bash

## This file gathers all docker-compose.yml files from [subfolders]/docker/docker-compose.yml and merges them with the -f option of the compose command.
## Instead of docker-compose up -d, write ./oms.sh up -d

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if ! [[ -f "$DIR/.env" ]]; then
    echo -e "[OMS] Copying .env file from .env.example"
    cp $DIR/.env.example $DIR/.env
fi

sudo docker network inspect OMS &>/dev/null || (echo -e "[OMS] Creating OMS docker network" && sudo docker network create OMS)

# HUMAN INTERVENTION NEEDED: register in .env your services
## Export all environment variables from .env to this script in case we need them some time
export $(cat .env | grep -v ^# | xargs)

## Create secrets
echo -e "[OMS] Creating random secrets if not existing"
## Create a new random jwt key
if ! [[ -f "$DIR/secrets/jwt_key" ]]; then
  mkdir -p $DIR/secrets
  cat /dev/random | head -c 256 | base64 > $DIR/secrets/jwt_key
fi

## Will not result in a valid sendgrid key but at least allows starting of the docker-compose stack
if ! [[ -f "$DIR/secrets/sendgrid_key" ]]; then
  mkdir -p $DIR/secrets
  cat /dev/random | head -c 256 | base64 > $DIR/secrets/sendgrid_key
fi

## If no certificate is provided, use a self-signed one
if ! [[ -f "$DIR/secrets/cert.pem" ]]; then
  mkdir -p $DIR/secrets
  openssl req -x509 -newkey rsa:4096 -keyout $DIR/secrets/key.pem -out $DIR/secrets/cert.pem -days 365 -nodes -batch
fi


## ENABLED_SERVICES holds a string separated by : with all enabled services (like "oms-global:omscore:oms-serviceregistry")
## If you want to change the enabled services, change the array in .env
service_string=$(printenv ENABLED_SERVICES)
## Split services into array
services=(${service_string//:/ })

command="sudo docker-compose -f $DIR/base-docker-compose.yml"
for s in "${services[@]}"; do
    if [[ -f "$DIR/${s}/docker/docker-compose.yml" ]]; then
        command="${command} -f $DIR/${s}/docker/docker-compose.yml"
    else
        echo -e "[OMS] WARNING: No docker file found for ${s} (full path $DIR/${s}/docker/docker-compose.yml)"
    fi
done

command="${command} ${@}"
echo -e "\n[OMS] Full command:\n${command}\n"
eval $command

#!/bin/bash

if [[ ! -f ./cachet/.env ]]; then
  #export PHP_APP_KEY=$(cat ../../.env | grep PHP_APP_KEY | awk -F= '{print $2}' )
  export $(cat ../../.env | grep -v ^# | xargs)
  envsubst < ./cachet/.env.example > ./cachet/.env
else
  echo "file exists already"
fi

sudo chown 82 ./cachet/.env

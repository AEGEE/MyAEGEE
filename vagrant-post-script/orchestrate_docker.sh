#!/bin/bash

cd /vagrant/ || exit 1

if [[ -f .env ]]; then
  dos2unix .env
  make start
else
  cp .env.example .env

  #git reset --hard HEAD
  #./helper.sh --bumpmodules
  make bootstrap
  sleep 120 #to give time for the bootstrap
fi

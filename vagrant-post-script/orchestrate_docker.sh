#!/bin/bash

cd /vagrant/ || exit 1

if [[ $(hostname) != "appserver" ]]; then
  mkdir -p /opt/MyAEGEE
  # shellcheck disable=SC2035
  cp -R . /opt/MyAEGEE
  cd /opt/MyAEGEE || exit 1
fi

if [[ -f .env ]]; then
  dos2unix .env
  docker network inspect OMS &>/dev/null || (echo -e "[MyAEGEE] Creating 'OMS' docker network" && docker network create OMS)
  make start
else
  cp .env.example .env

  #git reset --hard HEAD
  #./helper.sh --bumpmodules
  make bootstrap
  sleep 120 #to give time for the bootstrap
fi

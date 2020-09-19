#!/bin/bash

cd /vagrant/ || exit 1

if [[ -f .env ]]; then
  chmod +x helper.sh
  dos2unix .env Makefile helper.sh
  make start
else
  cp .env.example .env
  chmod +x helper.sh
  dos2unix .env Makefile helper.sh
  make bootstrap
fi

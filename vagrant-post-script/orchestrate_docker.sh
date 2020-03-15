#!/bin/bash

cd /vagrant/

if [[ -f .env ]]; then
  dos2unix .env
  make start
else
  git reset --hard HEAD
  #./helper.sh --bumpmodules
  make bootstrap
  sleep 120 #to give time for the bootstrap
fi

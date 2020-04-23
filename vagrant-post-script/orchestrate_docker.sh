#!/bin/bash

cd /vagrant/ || exit 1

if [[ -f .firstbootstrap ]]; then
  dos2unix .env
  make start
else
  touch .firstbootstrap
  #git reset --hard HEAD
  #./helper.sh --bumpmodules
  make bootstrap
  sleep 120 #to give time for the bootstrap
fi

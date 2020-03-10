#!/bin/bash

cd /vagrant/
#git reset --hard HEAD
#./helper.sh --bumpmodules
if [[ -f .env ]]; then
  make start
else
  make bootstrap
  sleep 120 #to give time for the bootstrap
fi

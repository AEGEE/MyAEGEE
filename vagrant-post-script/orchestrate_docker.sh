#!/bin/bash

cd /vagrant/

#install nvm
curl -sS -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash

if [[ -f .env ]]; then
  dos2unix .env
  make start
else
  git reset --hard HEAD
  #./helper.sh --bumpmodules
  make bootstrap
  sleep 120 #to give time for the bootstrap
fi

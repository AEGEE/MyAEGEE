#!/bin/bash

cd /vagrant/ || exit 1

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# find function copied from https://stackoverflow.com/questions/47712039/how-to-run-dos2unix-for-all-the-files-in-subfolders-in-bash
chmod +x helper.sh
find . -type f -name "*.sh" -exec dos2unix {} \+;
dos2unix .env Makefile

if [[ -f .env ]]; then
  make start
else
  make bootstrap
fi

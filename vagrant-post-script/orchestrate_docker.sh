#!/bin/bash

cd /vagrant/ || exit 1

# find function copied from https://stackoverflow.com/questions/47712039/how-to-run-dos2unix-for-all-the-files-in-subfolders-in-bash
if [[ -f .env ]]; then
  chmod +x helper.sh
  find . -type f -name "*.sh" -exec dos2unix {} \+;
  dos2unix .env Makefile
  make start
else
  cp .env.example .env
  chmod +x helper.sh
  find . -type f -name "*.sh" -exec dos2unix {} \+;
  dos2unix .env Makefile
  make bootstrap
fi

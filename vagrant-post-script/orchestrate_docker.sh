#!/bin/bash

cd /vagrant/ || exit 1

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# find function copied from https://stackoverflow.com/questions/47712039/how-to-run-dos2unix-for-all-the-files-in-subfolders-in-bash
chmod +x helper.sh
find . -type f -name "*.sh" -exec dos2unix {} \+;
dos2unix .env Makefile

if [[ -f .init ]]; then
  make start
else
  make bootstrap
fi


# frontend helper
cd frontend || exit 1
echo "node: $(node --version)"
echo "npm: $(npm --version)"
npm i || npm i --force && npx vue-cli-service build && chmod 775 -R dist && docker restart myaegee_frontend_1

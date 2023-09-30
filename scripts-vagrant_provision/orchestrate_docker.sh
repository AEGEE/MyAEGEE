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


  #shellcheck disable=SC2046
  export $(grep -v '^#' /vagrant/.env | xargs -d '\n')

  # frontend helper: the first bootstrap will have its files be inaccessible
  #   (return 403 unauthorised) without these operations
  if [[ "${MYAEGEE_ENV}" == "development" ]]; then
    cd /vagrant/frontend || exit 1
    echo "[Vagrant] ###################     Changing frontend permissions for first boot"
    echo "node: $(node --version)"
    echo "npm: $(npm --version)"
    #Node 16
    npm i > /dev/null || npm i --force > /dev/null && npx vue-cli-service build > /dev/null && chmod 775 -R dist && docker restart myaegee_frontend_1
    #Node 18
    #npm i || npm i --force && npm run build && chmod 775 -R dist && docker restart myaegee_frontend_1
  fi

fi


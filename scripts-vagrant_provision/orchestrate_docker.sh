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


  DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  #shellcheck disable=SC2046
  export $(grep -v '^#' ${DIR}/.env | xargs -d '\n')

  # frontend helper: the first bootstrap will have its files be inaccessible
  #   (return 403 unauthorised) without these operations
  if [[ "${MYAEGEE_ENV}" == "development" ]]; then
    cd /vagrant/frontend || exit 1
    echo "Changing frontend permissions"
    echo "node: $(node --version)"
    echo "npm: $(npm --version)"
    #Node 16
    npm i || npm i --force && npx vue-cli-service build && chmod 775 -R dist && docker restart myaegee_frontend_1
    #Node 18
    #npm i || npm i --force && npm run build && chmod 775 -R dist && docker restart myaegee_frontend_1
  fi

fi


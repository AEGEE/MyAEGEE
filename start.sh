#!/bin/bash
#THIS IS RUN ON THE HOST MACHINE manually by the user
# It will also start vagrant (or not)

#check how to bootstrap
novagrant=false
wsl=false
fast=false
reset=false
while [ "$#" -gt 0 ]; do
    case "$1" in
        --no-vagrant) novagrant=true; shift ;;
        --wsl) wsl=true; shift ;;
        --fast) fast=true; shift ;;
        --reset) reset=true; shift ;;

        -*) echo "Usage: start.sh [--no-vagrant|--wsl] [--reset] [--fast]"; exit 1;;
        *) echo "Usage: start.sh [--no-vagrant|--wsl] [--reset] [--fast]"; exit 1;;
    esac
done

check_etc_hosts () {
  # shellcheck disable=SC2143
  if grep -q 'traefik' /etc/hosts ; then #TODO improve by checking also the base_url
    echo '[Start script] ##### host file already good!'
  else
    echo '[Start script] ##### modifying the hosts file'
    # shellcheck disable=SC2016
    sudo bash -c 'echo "$1" "$2" "portainer.$2" "my.$2" "traefik.$2" "pgadmin.$2" "apidocs.$2" >> /etc/hosts' -- "${1}" "${2}"
  fi
}

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if ( $reset ); then
  if ( $wsl ); then
    # keep (or create) the .no-vagrant marker so helper.sh does not abort the
    # hostname check; then drop the .init marker so make bootstrap re-initialises.
    touch "${DIR}/.no-vagrant"
    rm -f "${DIR}/.init"
    make nuke_dev || true
  else
    vagrant destroy
  fi
fi

if [ ! -f "${DIR}"/.env ]; then #check if it exists, if not take the example
    cp "${DIR}"/.env.example "${DIR}"/.env
fi

#shellcheck disable=SC2046
export $(grep -v '^#' ${DIR}/.env | xargs -d '\n')

#run accordingly
if ( $wsl ); then
  # WSL2 mode: Docker Desktop on Windows handles the engine, the Windows hosts
  # file is configured by the bootstrap-windows.ps1 script run on the Windows host.
  # We keep BASE_URL=appserver.test untouched so the same URLs work as on Linux/Mac.
  if [[ "$(pwd)" == /mnt/c/* || "$(pwd)" == /mnt/[a-z]/* ]]; then
    echo '[Start script] ##### ERROR: you are running from a Windows-mounted drive (/mnt/...).'
    echo '[Start script] ##### Move the repo into the WSL filesystem (e.g. ~/myaegee) and retry.'
    echo '[Start script] ##### Reason: file permissions, line endings and IO performance are broken on /mnt/.'
    exit 1
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo '[Start script] ##### ERROR: docker is not available inside WSL.'
    echo '[Start script] ##### Install Docker Desktop for Windows and enable the WSL2 integration:'
    echo '[Start script] ##### Docker Desktop > Settings > Resources > WSL integration > enable your distro.'
    exit 1
  fi
  if ( $fast ); then
    sed -i 's/development/production/' .env
    # shellcheck disable=SC2046
    export $(grep -v '^#' ${DIR}/.env | xargs -d '\n')
  fi
  # Detect whether this is a fresh bootstrap so we know if we need to apply the
  # frontend permissions fix (otherwise the first visit to my.appserver.test
  # returns NGINX 403). See scripts-vagrant_provision/orchestrate_docker.sh.
  initial_run=false
  if [[ ! -f "${DIR}/.init" ]]; then
    initial_run=true
  fi
  touch "${DIR}/.no-vagrant"
  make bootstrap

  if ( $initial_run ) && [[ "${MYAEGEE_ENV}" == "development" ]]; then
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
      echo '[Start script] ##### Applying frontend permissions fix for first boot (this avoids NGINX 403)'
      ( cd "${DIR}/frontend" && \
          ( npm i > /dev/null 2>&1 || npm i --force > /dev/null 2>&1 ) && \
          npx vue-cli-service build > /dev/null 2>&1 && \
          chmod 775 -R dist && \
          docker restart myaegee_frontend_1 ) \
        || echo '[Start script] ##### WARNING: frontend fix failed, see Troubleshooting in README.md if you get 403.'
    else
      echo '[Start script] ##### NOTE: node/npm not found inside WSL2, skipping the frontend permissions fix.'
      echo '[Start script] ##### If http://my.appserver.test returns NGINX 403, install Node 16 (e.g. via nvm) and run:'
      echo "[Start script] #####   cd ${DIR}/frontend && npm i && npx vue-cli-service build && chmod 775 -R dist && docker restart myaegee_frontend_1"
    fi
  fi
elif ( $novagrant ); then
  check_etc_hosts "127.0.0.1" "localhost"
  sed -i 's/appserver/localhost/' .env
  touch "${DIR}/.no-vagrant"
  make bootstrap
else
  check_etc_hosts "192.168.168.168" "${BASE_URL}"
  if ( $fast ); then
    sed -i 's/development/production/' .env
  fi
  vagrant box list | grep "202303.13.0" -q || vagrant box add bento/ubuntu-18.04 --provider virtualbox --box-version "202303.13.0" -c
  vagrant plugin list | grep vbguest -q || vagrant plugin install vagrant-vbguest
  ansible-galaxy role install -r scripts-vagrant_provision/requirements-ansible.yml
  export ANSIBLE_NOCOWS=false
  vagrant up
fi


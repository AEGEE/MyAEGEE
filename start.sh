#!/bin/bash
#THIS IS RUN ON THE HOST MACHINE manually by the user
# It will also start vagrant (or not)

#check how to bootstrap
novagrant=false
notraefik=false
fast=false
reset=false
while [ "$#" -gt 0 ]; do
    case "$1" in
        --no-vagrant) novagrant=true; shift ;;
        --no-traefik) notraefik=true; novagrant=true; shift ;;
        --fast) fast=true; shift ;;
        --reset) reset=true; shift ;;

        -*) echo "Usage: start.sh [--no-vagrant|--no-traefik] [--reset] [--fast]"; exit 1;;
        *) echo "Usage: start.sh [--no-vagrant|--no-traefik] [--reset] [--fast]"; exit 1;;
    esac
done

check_etc_hosts () {
  # shellcheck disable=SC2143
  if grep -qF "traefik.${2}" /etc/hosts ; then
    echo '[Start script] ##### host file already good!'
  else
    echo '[Start script] ##### modifying the hosts file'
    # shellcheck disable=SC2016
    sudo bash -c 'echo "$1" "$2" "portainer.$2" "my.$2" "traefik.$2" "pgadmin.$2" "apidocs.$2" >> /etc/hosts' -- "${1}" "${2}"
  fi
}

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if $reset && ! $novagrant; then
  vagrant destroy
fi

if [ ! -f "${DIR}"/.env ]; then #check if it exists, if not take the example
    cp "${DIR}"/.env.example "${DIR}"/.env
fi

#shellcheck disable=SC2046
export $(grep -v '^#' "${DIR}"/.env | xargs -d '\n')

# set_env_var NAME VALUE: set NAME=VALUE in .env, adding the line if it's missing
set_env_var () {
  if grep -q "^${1}=" "${DIR}"/.env; then
    sed -i "s|^${1}=.*|${1}=${2}|" "${DIR}"/.env
  else
    echo "${1}=${2}" >> "${DIR}"/.env
  fi
}

#run accordingly
if ( $notraefik ); then
  # Everything runs on the host; the frontend dev server replaces Traefik.
  set_env_var MYAEGEE_GATEWAY devserver
  make bootstrap
  echo "[Start script] ##### MyAEGEE is starting on http://localhost:${FRONTEND_PORT:-8083} (the first start installs the frontend's dependencies, follow it with: ./helper.sh --monitor frontend)"
elif ( $novagrant ); then
  check_etc_hosts "127.0.0.1" "localhost"
  sed -i 's/appserver/localhost/' .env
  set_env_var MYAEGEE_GATEWAY traefik
  # Also keeps later `make` calls on the host working.
  set_env_var MYAEGEE_SKIP_GUEST_CHECK true
  make bootstrap
else
  # The VM reads this .env too (/vagrant), so undo an earlier --no-traefik.
  set_env_var MYAEGEE_GATEWAY traefik
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


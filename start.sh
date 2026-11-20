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

# shellcheck source=scripts-server/load-env.sh
. "${DIR}"/scripts-server/load-env.sh
load_env "${DIR}"/.env

# edit_env SED_SCRIPT: edit .env in place. Not `sed -i`, which takes its
# argument differently in GNU and BSD (macOS) sed. Writing back with `cat`
# keeps the file's permissions (and a symlinked .env).
edit_env () {
  local tmp
  tmp=$(mktemp "${DIR}/.env.tmp.XXXXXX") || exit 1
  if sed "${1}" "${DIR}"/.env > "${tmp}"; then
    cat "${tmp}" > "${DIR}"/.env
  fi
  rm -f "${tmp}"
}

# set_env_var NAME VALUE: set NAME=VALUE in .env, adding the line if it's missing
set_env_var () {
  if grep -q "^${1}=" "${DIR}"/.env; then
    edit_env "s|^${1}=.*|${1}=${2}|"
  else
    # Don't glue the new line onto a last line without a newline.
    if [ -n "$(tail -c 1 "${DIR}"/.env)" ]; then
      echo >> "${DIR}"/.env
    fi
    echo "${1}=${2}" >> "${DIR}"/.env
  fi
}

# --reset without Vagrant: remove the containers and volumes (databases,
# uploads) of the Docker stack on this machine. The source code, secrets/ and
# .init stay.
reset_host_stack () {
  if $reset; then
    if [ -t 0 ]; then
      read -r -p '[Start script] ##### --reset deletes the containers and volumes (databases, uploads) of the Docker stack. Continue? [y/N] ' answer
      case "${answer}" in
        [yY]*) ;;
        *) echo '[Start script] ##### not resetting'; exit 1 ;;
      esac
    fi
    echo '[Start script] ##### --reset: removing the Docker stack and its volumes'
    "${DIR}"/helper.sh --nuke || { echo '[Start script] ##### --reset failed, not starting'; exit 1; }
  fi
}

#run accordingly
if ( $notraefik ); then
  # Everything runs on the host; the frontend dev server replaces Traefik.
  set_env_var MYAEGEE_GATEWAY devserver
  reset_host_stack
  make bootstrap || exit 1
  echo "[Start script] ##### MyAEGEE is starting on http://localhost:${FRONTEND_PORT:-8083} (the first start installs the frontend's dependencies, follow it with: ./helper.sh --monitor frontend)"
elif ( $novagrant ); then
  check_etc_hosts "127.0.0.1" "localhost"
  edit_env 's/appserver/localhost/'
  set_env_var MYAEGEE_GATEWAY traefik
  # Also keeps later `make` calls on the host working.
  set_env_var MYAEGEE_SKIP_GUEST_CHECK true
  reset_host_stack
  make bootstrap || exit 1
else
  # The VM reads this .env too (/vagrant), so switch off the settings of an
  # earlier --no-traefik or --no-vagrant (BASE_URL stays as it is).
  set_env_var MYAEGEE_GATEWAY traefik
  set_env_var MYAEGEE_SKIP_GUEST_CHECK false
  check_etc_hosts "192.168.168.168" "${BASE_URL}"
  if ( $fast ); then
    edit_env 's/development/production/'
  fi
  vagrant box list | grep "202303.13.0" -q || vagrant box add bento/ubuntu-18.04 --provider virtualbox --box-version "202303.13.0" -c
  vagrant plugin list | grep vbguest -q || vagrant plugin install vagrant-vbguest
  ansible-galaxy role install -r scripts-vagrant_provision/requirements-ansible.yml
  export ANSIBLE_NOCOWS=false
  vagrant up
fi


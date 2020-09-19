#!/bin/bash
#THIS IS RUN ON THE HOST MACHINE
# It will also start vagrant (or not)

#check how to bootstrap
novagrant=false
fast=false
reset=false
while [ "$#" -gt 0 ]; do
    case "$1" in
        --no-vagrant) novagrant=true; shift ;;
        --fast) fast=true; shift ;;
        --reset) reset=true; shift ;;

        -*) echo "Usage: start.sh [--novagrant] [--reset] [--fast]"; exit 1;;
        *) echo "Usage: start.sh [--novagrant] [--reset] [--fast]"; exit 1;;
    esac
done

check_etc_hosts () {
  # shellcheck disable=SC2143
  if [[ ! $(grep -q 'traefik' /etc/hosts) ]]; then
    echo 'modifying the hosts file'
    # shellcheck disable=SC2016
    sudo bash -c 'echo "$1" "$2" "portainer.$2" "my.$2" "traefik.$2" >> /etc/hosts' -- "${1}" "${2}"
  fi
}

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if ( $reset ); then
  echo
  echo
  echo "CAREFUL! you are deleting your .env"
  echo "here it is, in case you forgot to save some tokens/configs"
  echo
  echo
  sed '/AEGEE_LOGO_B64/d' "${DIR}/.env"
  rm "${DIR}/.env"
  echo
  echo "MORE CAREFUL! you are deleting your development machine"
  echo
  vagrant destroy
fi

if [ ! -f "${DIR}"/.env ]; then #check if it exists, if not take the example
    cp "${DIR}"/.env.example "${DIR}"/.env
fi

#run accordingly
if ( $novagrant ); then
  check_etc_hosts "127.0.0.1" "localhost"
  make bootstrap
else
  check_etc_hosts "192.168.168.168" "appserver.test"
  sed -i 's/localhost/appserver/' .env
  if ( $fast ); then
    sed -i 's/development/production/' .env
  fi
  vagrant up
fi


#!/bin/bash
#THIS IS RUN ON THE HOST MACHINE manually by the user
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

        -*) echo "Usage: start.sh [--no-vagrant] [--reset] [--fast]"; exit 1;;
        *) echo "Usage: start.sh [--no-vagrant] [--reset] [--fast]"; exit 1;;
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
  vagrant destroy
fi

if [ ! -f "${DIR}"/.env ]; then #check if it exists, if not take the example
    cp "${DIR}"/.env.example "${DIR}"/.env
fi

#shellcheck disable=SC2046
export $(grep -v '^#' ${DIR}/.env | xargs -d '\n')

#run accordingly
if ( $novagrant ); then
  check_etc_hosts "127.0.0.1" "localhost"
  sed -i 's/appserver/localhost/' .env
  make bootstrap
else
  check_etc_hosts "192.168.168.168" "${BASE_URL}"
  if ( $fast ); then
    sed -i 's/development/production/' .env
  fi
  vagrant box list | grep "202303.13.0" -q || vagrant box add bento/ubuntu-18.04 --provider virtualbox --box-version "202303.13.0" -c
  vagrant plugin list | grep vbguest -q || vagrant plugin install vagrant-vbguest
  vagrant up
fi


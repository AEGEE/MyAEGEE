#!/bin/bash
#THIS IS RUN ON THE HOST MACHINE
# It will also start vagrant (or not)

#check how to bootstrap
novagrant=false
while [ "$#" -gt 0 ]; do
    case "$1" in
        --no-vagrant) novagrant=true; shift ;;

        -*) echo "Usage: start.sh [--novagrant]"; exit 1;;
        *) echo "Usage: start.sh [--novagrant]"; exit 1;;
    esac
done

check_etc_hosts () {
  if [[ ! $(grep -q 'traefik' /etc/hosts) ]]; then
    #modify the hosts file
    echo 'modifying the hosts file'
    sudo bash -c 'echo "$1" "$2" "portainer.$2" "my.$2" "traefik.$2" >> /etc/hosts' -- "${1}" "${2}"
  fi
}

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
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
  vagrant up
fi


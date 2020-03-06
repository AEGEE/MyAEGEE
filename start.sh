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
  cat /etc/hosts | grep 'portainer' > /dev/null
  if (( $? )); then
    #modify the hosts file
    echo 'modifying the hosts file'
    sudo bash -c 'echo "$1" "$2" "portainer.$2" "my.$2" "traefik.$2" >> /etc/hosts' -- $1 $2
  fi
}

#run accordingly
if ( $novagrant ); then
  check_etc_hosts "127.0.0.1" "localhost"
  make bootstrap
else
  check_etc_hosts "192.168.168.168" "appserver.test"
  sed 's/localhost/appserver/' .env.example > .env
  vagrant up
fi


#!/bin/bash
#THIS IS RUN ON THE HOST MACHINE manually by the user
# It will bootstrap the environment (Vagrant VM or direct Docker on Ubuntu)

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

# Detect OS for automatic direct Docker setup
detect_os() {
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        if [ "$ID" = "ubuntu" ] && [ "$VERSION_ID" = "24.04" ]; then
            return 0  # Ubuntu 24.04 detected
        fi
    fi
    return 1  # Not Ubuntu 24.04
}

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
  # Direct Docker mode (for manual --no-vagrant flag)
  check_etc_hosts "127.0.0.1" "localhost"
  sed -i 's/appserver/localhost/' .env
  
  # Check if running on Ubuntu 24.04 and Docker not installed
  if detect_os && ! command -v docker >/dev/null 2>&1; then
    echo "[Start script] Ubuntu 24.04 detected without Docker"
    echo "[Start script] Running bootstrap script to install dependencies..."
    if [ -x "${DIR}/scripts-ubuntu/bootstrap.sh" ]; then
      "${DIR}/scripts-ubuntu/bootstrap.sh"
    else
      echo "[Start script] ERROR: scripts-ubuntu/bootstrap.sh not found or not executable"
      echo "[Start script] Please run: chmod +x scripts-ubuntu/bootstrap.sh"
      exit 1
    fi
  fi
  
  make bootstrap
elif detect_os && ! ( $fast ); then
  # Auto-detect Ubuntu 24.04 and offer direct Docker setup
  echo "[Start script] Ubuntu 24.04 detected!"
  echo "[Start script] You can run MyAEGEE directly with Docker (faster, uses less memory)"
  echo "[Start script] or use the traditional Vagrant setup."
  echo ""
  read -r -p "Use direct Docker on Ubuntu? [Y/n] " response
  case "$response" in
    [nN][oO]|[nN])
      echo "[Start script] Using Vagrant setup..."
      # Fall through to Vagrant setup below
      ;;
    *)
      echo "[Start script] Using direct Docker setup..."
      # Run Ubuntu bootstrap script
      if [ ! -x "${DIR}/scripts-ubuntu/bootstrap.sh" ]; then
        echo "[Start script] Making bootstrap script executable..."
        chmod +x "${DIR}/scripts-ubuntu/bootstrap.sh"
      fi
      "${DIR}/scripts-ubuntu/bootstrap.sh"
      exit $?
      ;;
  esac
  
  # Vagrant setup (if user declined direct Docker or as fallback)
  check_etc_hosts "192.168.56.168" "${BASE_URL}"
  if ( $fast ); then
    sed -i 's/development/production/' .env
  fi
  vagrant box list | grep "202303.13.0" -q || vagrant box add bento/ubuntu-18.04 --provider virtualbox --box-version "202303.13.0" -c
  vagrant plugin list | grep vbguest -q || vagrant plugin install vagrant-vbguest
  ansible-galaxy role install -r scripts-vagrant_provision/requirements-ansible.yml
  export ANSIBLE_NOCOWS=false
  vagrant up
else
  # Default Vagrant setup (non-Ubuntu 24.04 or --fast mode)
  check_etc_hosts "192.168.56.168" "${BASE_URL}"
  if ( $fast ); then
    sed -i 's/development/production/' .env
  fi
  vagrant box list | grep "202303.13.0" -q || vagrant box add bento/ubuntu-18.04 --provider virtualbox --box-version "202303.13.0" -c
  vagrant plugin list | grep vbguest -q || vagrant plugin install vagrant-vbguest
  ansible-galaxy role install -r scripts-vagrant_provision/requirements-ansible.yml
  export ANSIBLE_NOCOWS=false
  vagrant up
fi


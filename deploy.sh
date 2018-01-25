#!/bin/bash

# MANUAL INTERVENTION NEEDED:
#   This file MUST be 1 level above the oms-docker installation!

#This script assumes that it is run on a production server. It is meant to be safe for cron updates
# NOTE: to change passwords through the script, one must do a HARD reset (a new install or a nuke is what takes the password script to run). The script will error if passwords are not set properly

#STEP 1 check if we have to make a new setup (first time/nuke) or an update (default: assumes non-destructive update, rolls back to the first time - never nukes unless specified)
#STEP 2 run password script (if new deployment)
#STEP 3 application will be deployed

#read params to understand (default:non-destructive)
fresh="false"
nuke="false"
error="false"
if [ $# -eq 1 ]; then
  if [ "$1" == "--fresh" ]; then
    fresh="true"
  else
    if [ "$1" == "--nuke" ]; then
      fresh="true"
      nuke="true"
    else
      error="true"
    fi
  fi
else
  if [ ! $# -eq 0 ]; then
    error="true"
  fi
fi

if [ "$error" == "true" ]; then
  echo -e "usage: deploy.sh [--fresh|--nuke]"
  exit 8
fi

EDITOR=$(env | grep EDITOR | grep -oe '[^=]*$');
if [ -z "$EDITOR" ]; then
  export EDITOR="nano"
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
#DEBUG echo
echo 'the directory is ${DIR} and bash source is ${BASH_SOURCE[0]} and the wtf is $( dirname "${BASH_SOURCE[0]}" )'
#assuming i am in /opt/MyAEGEE
if [ "$fresh" == "true" ]; then
  echo -e "\n[Deployment] Nuking installation (removing .env = $nuke )\n"
  bash $DIR/oms-docker/oms.sh down -v
  cp $DIR/oms-docker/.env .env
  rm -Rf $DIR/oms-docker
  if [ "$nuke" == "true" ]; then
    echo -e "\n[Deployment] Removing .env\n"
    rm .env
  fi
fi

if [ -f oms-docker/.env ]; then
  echo -e "\n[Deployment] Updating installation\n"
  cd oms-docker/
  git pull
  git submodule init
  git submodule update
  echo -e "\n[Deployment] Update performed, restarting containers\n"
  mv ../.env $DIR/oms-docker/.env 
  bash $DIR/oms-docker/oms.sh up -d
else
  echo -e "\n[Deployment] New installation\n"
  echo -e "\n[Deployment] Cloning repo (output suppressed)\n"
  git clone --recursive --branch dev https://github.com/AEGEE/oms-docker.git 1>/dev/null 2>&1
  cp $DIR/oms-docker/.env.example $DIR/oms-docker/.env
  #Ask if one wants to tweak the .env before starting it up
  echo "Do you wish to edit .env file? (write the number)"
  select yn in "Yes" "No"; do
    case $yn in
        Yes ) cp oms-docker/.env.example oms-docker/.env; sudo $EDITOR oms-docker/.env; break;;
        No ) break;;
    esac
  done
  echo -e "\n[Deployment] Setting passwords\n"
  bash $DIR/oms-docker/password-setter.sh
  if [[ -f "$DIR/oms-docker/oms-core/storage/key" ]]; then
    echo -e "WARNING: The application key is already set, security compromised!"
    echo -e "WARNING: The application key is already set, security compromised!"
    echo -e "WARNING: The application key is already set, security compromised!"
    echo -e "WARNING: The application key is already set, security compromised!"
    echo -e "WARNING: The application key is already set, security compromised!"
    echo -e "WARNING: The application key is already set, security compromised!"
    echo -e "WARNING: The application key is already set, security compromised!"
  fi
  echo -e "\n[Deployment] Deploying (This could take a while)\n"
  cd $DIR/oms-docker
  bash oms.sh up -d
  sleep 5
  echo -e "\n[Deployment] Showing logs, feel free to cancel with ctrl+c (server keeps running anyway)\n"
  bash $DIR/oms-docker/oms.sh logs -f
fi

#!/bin/bash

# MANUAL INTERVENTION NEEDED:
#   This file MUST be 1 level above the oms-docker installation!

folderName="oms-docker" #could also be MyAEGEE or whatever e.g. /opt/MyAEGEE

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

export EDITOR=$(env | grep EDITOR | grep -oe '[^=]*$');
if [ -z "$EDITOR" ]; then
  echo "[Deployment] no EDITOR variable, setting it to vim"
  export EDITOR="vim";
fi

#what's this line for?! According to the commit message,
#"Paths are now relative to script location instead of execution location"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
#DEBUG echo
echo -e "\n the directory is ${DIR} and bash source is ${BASH_SOURCE[0]} and the wtf is $( dirname '${BASH_SOURCE[0]}' )"

#FRESH/NUKE: nuke installation (bring it down and up again without volumes)
# nuke is just removing .env and using the repo one (.env.example)
if [ "$fresh" == "true" ]; then
  echo -e "\n[Deployment] Stopping installation (removing .env = $nuke )\n"
  bash $DIR/oms-docker/oms.sh down -v 
  if [ ! $RUN_BY_CRON ]; then
    #ONLY FOR Test server
    bash $DIR/oms-docker/oms.sh down -v --remove-orphans
  fi
  cp $DIR/oms-docker/.env $DIR/.env 
  if [ "$nuke" == "true" ]; then
    echo -e "\n[Deployment] Removing .env (nuking)\n"
    rm $DIR/.env
  fi
fi

#BRINGING IT UP: if there is a .env file it's an update
# otherwise it's a fresh setup
if [ -f $DIR/oms-docker/.env ]; then
  echo -e "\n[Deployment] Updating installation\n"
  
  cd $DIR/oms-docker/
  git pull
  git submodule init
  git submodule update
   
  echo -e "\n[Deployment] Update performed, restarting containers\n"
  bash $DIR/oms-docker/oms.sh up -d
else
  echo -e "\n[Deployment] New installation\n"
  echo -e "\n[Deployment] Cloning repo (normal output suppressed)\n"
  git clone --recursive --branch dev https://github.com/AEGEE/oms-docker.git 1>/dev/null

  #if there is a .env in /opt use that, otherwise oms.sh will copy
  if [ -f $DIR/.env ]; then
    pwd
    mv $DIR/.env $DIR/oms-docker/.env 
  fi 

  if [ ! $RUN_BY_CRON ]; then
    #Ask if one wants to tweak the .env before starting it up
    echo "Do you wish to edit .env file? (write the number)"
    select yn in "Yes" "No"; do
      case $yn in
          Yes ) $EDITOR oms-docker/.env; break;;
          No ) break;;
      esac
    done
  fi
  echo -e "\n[Deployment] Setting passwords\n"
  bash $DIR/oms-docker/password-setter.sh
  echo -e "\n[Deployment] Deploying (This could take a while)\n"
  bash $DIR/oms-docker/oms.sh up -d
  sleep 10
  echo -e "\n[Deployment] Showing logs, feel free to cancel with ctrl+c (server keeps running anyway)\n"
  bash $DIR/oms-docker/oms.sh logs -f
fi

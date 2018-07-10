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

EDITOR=$(env | grep EDITOR | grep -oe '[^=]*$');
if [ -z "$EDITOR" ]; then
  export EDITOR="vim";
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
#DEBUG echo
echo -e "\n the directory is ${DIR} and bash source is ${BASH_SOURCE[0]} and the wtf is $( dirname '${BASH_SOURCE[0]}' )"

#FRESH/NUKE: nuke installation (bring it down and up again without volumes)
# nuke is just removing .env and using the repo one
if [ "$fresh" == "true" ]; then
  echo -e "\n[Deployment] Nuking installation (removing .env = $nuke )\n"
  bash $DIR/oms-docker/oms.sh down -v 
  #ONLY FOR DEv
  bash $DIR/oms-docker/oms.sh down -v --remove-orphans
  #END ONLY FOR DEV
  cp $DIR/oms-docker/.env $DIR/.env #NOTE check how many times/why i copy .env outside the folder
  rm -Rf $DIR/oms-docker/
  mkdir $DIR/oms-docker/
  #DEV only for me to mess around
  chown -R grasshopper:grasshopper $DIR/oms-docker/
  #END DEV for me to mess around
  if [ "$nuke" == "true" ]; then
    echo -e "\n[Deployment] Removing .env\n"
    rm .env
  fi
fi

#BRINGING IT UP: if there is a .env file it's an update
# otherwise it's a fresh setup
if [ -f ./oms-docker/.env ]; then
  echo -e "\n[Deployment] Updating installation\n"
  
  #cd oms-docker/
  pwd #REMOVEE
  #PROD: git pull
  #git pull
  #git submodule init
  #git submodule update
  #DEV: rsync from /opt/masterRepo
  rsync -hrPt --include=.git --exclude=node_modules/ --delete /opt/masterRepo/ /opt/oms-docker
   
  echo -e "\n[Deployment] Update performed, restarting containers\n"
  mv /opt/.env $DIR/oms-docker/.env #NOTE useless basically (but see above anyway)
  bash $DIR/oms-docker/oms.sh up -d
else
  echo -e "\n[Deployment] New installation\n"
  echo -e "\n[Deployment] Cloning repo (normal output suppressed)\n"
  #PRODUCTION: a git clone
  #git clone --recursive --branch feat-autodeploy https://github.com/AEGEE/oms-docker.git 1>/dev/null
  #DEVELOPMENT: a copy from filesystem (from an up-to-date, manually edited repo)
  rsync -hrPt --include=.git --exclude=node_modules/ --delete /opt/masterRepo/ /opt/oms-docker
  
  #DEV only for me to mess around
  chown -R grasshopper:grasshopper /opt/oms-docker #NOTE user?
  #END DEV only for me to mess around

  cp $DIR/oms-docker/.env.example $DIR/oms-docker/.env
  cp $DIR/oms-docker/.env $DIR/.env
  
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

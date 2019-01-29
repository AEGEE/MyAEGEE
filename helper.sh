#!/bin/bash

#NEW structure: now eberything here will be a target of makefile.
# Then helper.sh calls the target according to the parameter of the shell script 
# (which could have -v for verbose.. so sergey is happy)
#...... or at least I guess? Alternative is that you make shit loads of IFs like in deploy/oms.sh

# with this file you can:

#CATEGORY: DEV
# bump the version of the oms submodules and commit (currently not there)
bump_repo()
{
    git submodule foreach "git checkout master"
    git add $(git submodule status | grep '^+' |  awk '{ print $2 }')
    #if something is staged, do the following two lines
    git diff --cached --quiet 
    if (( "$?" )); then 
        git checkout -b "bump-submodules-$(date '+%d-%m')-$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 4)"
        git commit -m "(bump) Bump version of the submodules via make bump"
    fi
}

#CATEGORY: DEPLOY
# create first secrets (currently oms.sh)
# FIRST DEPLOYMENT
init_boot ()
{
    #always check if the repo is "complete"
    git submodule update --init

    docker network inspect OMS &>/dev/null || (echo -e "[OMS] Creating OMS docker network" && docker network create OMS)
}

# change passwords (currently deploy.sh [calls an external script])
# FIRST DEPLOYMENT
pw_changer()
{
    echo -e "\n[Deployment] Setting passwords\n"
    bash $DIR/password-setter.sh
}

# wrapper for the compose mess (ACCEPTS PARAMETERS)
compose-wrapper()
{ #TO DO: put hostname check and do not accept the nuke and stop in production
    service_string=$(printenv ENABLED_SERVICES)
    services=(${service_string//:/ })
    command="docker-compose -f $DIR/base-docker-compose.yml"
    for s in "${services[@]}"; do
        if [[ -f "$DIR/${s}/docker/docker-compose.yml" ]]; then
            command="${command} -f $DIR/${s}/docker/docker-compose.yml"
        else
            echo -e "[OMS] WARNING: No docker file found for ${s} (full path $DIR/${s}/docker/docker-compose.yml)"
        fi
    done
    command="${command} ${@}"
    if ( $verbose ); then
        echo -e "\n[OMS] Full command:\n${command}\n"
    fi
    eval $command
}

# build it for the first time (currently Makefile that calls oms.sh [build])
# FIRST DEPLOYMENT
#compose-wrapper build

# launch it (currently Makefile that calls oms.sh [start])
# FIRST DEPLOYMENT
#compose-wrapper up -d

# update the running instance (build only - does not bump submodules) and relaunch (currently Makefile that calls oms.sh [live-refresh])
# THIS IS THE TARGET FOR AUTO DEPLOYMENTS
#compose-wrapper up -d --build

# edit the env file before launching (currently deploy.sh)
# FIRST DEPLOYMENT
edit_env_file ()
{
    export EDITOR=$(env | grep EDITOR | grep -oe '[^=]*$');
    if [ -z "$EDITOR" ]; then
      echo "[Deployment] no EDITOR variable, setting it to vim"
      export EDITOR="vim";
    fi
    if ( ! $NON_INTERACTIVE ); then
        #Ask if one wants to tweak the .env before starting it up
        echo "Do you wish to edit .env file? (write the number)"
        select yn in "Yes" "No"; do
        case $yn in
            Yes ) $EDITOR $DIR/.env; break;;
            No ) break;;
        esac
        done
    fi
}

# nuke the installation (currently both deploy AND makefile launching both oms.sh [nuke])
# (has a security check, near the end)
# compose-wrapper down -v

# show logs (even if NOW they go to logstash)
#compose-wrapper logs -f #and additional args: the names of the containers, after -f
#FIXME: with the make target, it cannot follow specific logs

# execute command
#compose-wrapper exec #and additional args: the name of the container and the command
#FIXME: with the make target, arguments cannot be specified 

# HUMAN INTERVENTION NEEDED: register in .env your services
## Export all environment variables from .env to this script in case we need them some time
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ ! -f $DIR/.env ]; then
    cp $DIR/.env.example $DIR/.env
fi
export $(cat $DIR/.env | grep -v ^# | xargs)

# Entry: check if the number of arguments is max 2 (one for the target one for the verbose)
init=false;
build=false;
start=false;
refresh=false;
monitor=false;
stop=false;
nuke=false;
bump=false;
execute=false;
command_num=0;
declare -a arguments # = EMPTY ARRAY
if [[ "$#" -ge 1 ]]; then

    while [ "$#" -gt 0 ]; do
        case "$1" in
            --init) init=true; ((command_num++)); shift ;;
            --build) build=true; ((command_num++)); shift ;;
            --start) start=true; ((command_num++)); shift ;;
            --refresh) refresh=true; ((command_num++)); shift ;;
            --monitor) monitor=true; ((command_num++)); shift ;;
            --stop) stop=true; ((command_num++)); shift ;;
            --nuke) nuke=true; ((command_num++)); shift ;;
            --bump) bump=true; ((command_num++)); shift ;;
            --execute) execute=true; ((command_num++)); shift ;;
            
            -v) verbose=true; shift ;;

            -*) echo "unknown option: $1" >&2; 
                echo "Usage: helper.sh {--init|--build|--start|--refresh|--monitor|--stop|--nuke|--execute|--bump} [-v]"; exit 1;;
            *) arguments+="$1 "; shift;;
        esac
    done

else
    echo "Usage: helper.sh {--init|--build|--start|--refresh|--monitor|--stop|--nuke|--execute|--bump} [-v]"; exit 1
fi

if (( $command_num > 1 )); then
    echo "Too many commands! Only one command per time"
    echo "Usage: helper.sh {--init|--build|--start|--refresh|--monitor|--stop|--nuke|--execute|--bump} [-v]"; exit 1
fi

if ( $init ); then
    init_boot && NON_INTERACTIVE=true; edit_env_file && pw_changer
fi

if ( $build ); then
    compose-wrapper build
fi

if ( $start ); then
    compose-wrapper up -d
fi

if ( $refresh ); then #THIS IS AN UPGRADING, i.e. CD pipeline target
    compose-wrapper up -d --build
fi

if ( $monitor ); then
    compose-wrapper logs -f $arguments
fi

if ( $execute ); then
    compose-wrapper exec $arguments
fi

if ( $stop ); then
    compose-wrapper stop
fi

if ( $nuke ); then
    if [[ "$(hostname)" == *prod* ]]; then
        echo "DUUUDE you can't kill production" && exit 1; 
    else if [[ "$(hostname)" == *staging* ]]; then
           echo "DUUUDE you better do this manually, no script" && exit 2; 
         else
           compose-wrapper down -v
         fi
    fi 
fi

if ( $bump ); then
    bump_repo
fi

#return 0;


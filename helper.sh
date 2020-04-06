#!/bin/bash
#THIS IS RUN ON THE MACHINE that you decided would run
#the app: either the guest (with Vagrant) or your host machine

# NEW structure: now eberything here will be a target of makefile.
# Then helper.sh calls the target according to the parameter of the shell script
# (which could have -v for verbose.. so sergey is happy)
#...... or at least I guess? Alternative is that you make shit loads of IFs like in deploy/oms.sh

# with this file you can:

#CATEGORY: DEV
# bump the version of the oms submodules and commit (currently not there)
bump_repo ()
{
    git submodule foreach "git checkout master && git pull"
    git add $(git submodule status | grep '^+' |  awk '{ print $2 }')
    #if something is staged, do the following two lines
    git diff --cached --quiet
    if (( "$?" )); then
        git checkout -b "bump-submodules-$(date '+%d-%m')-$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 4)"
        git commit -m "bump: Bump version of the submodules via make bump"
    fi
}

# bump the version of the oms submodules and commit (currently not there)
bump_nocommit ()
{
    git submodule foreach "git checkout master && git pull"
    git add $(git submodule status | grep '^+' |  awk '{ print $2 }')
    #if something is staged, do the following two lines
    git diff --cached --quiet
    if (( "$?" )); then
        echo "all right"
    fi
}

#CATEGORY: DEPLOY
# 'create first secrets' is in start.sh
# FIRST DEPLOYMENT
init_boot ()
{
    #always check if the repo is "complete"
    git submodule update --init

    docker network inspect OMS &>/dev/null || (echo -e "[MyAEGEE] Creating 'OMS' docker network" && docker network create OMS)


    touch "${DIR}"/secrets/acme.json # to avoid making it think it's a folder
    chmod 600 "${DIR}"/secrets/acme.json # Traefik doesn't let ACME challenge go through otherwise

    touch "${DIR}"/oms-global/docker/traefik/traefik.toml # to avoid making it think it's a folder
    if [[ "${MYAEGEE_ENV}" != "development" ]]; then
      envsubst < "${DIR}"/oms-global/docker/traefik/traefik.toml.template > "${DIR}"/oms-global/docker/traefik/traefik.toml
    else
      cat "${DIR}"/oms-global/docker/traefik/traefik.toml.dev > "${DIR}"/oms-global/docker/traefik/traefik.toml
    fi

    echo -e "\n[Deployment] Setting secrets\n"
    bash "${DIR}"/vagrant-post-script/generate_secrets.sh

    echo "manual things still to do (if applicable use-case): "
    echo "  init cachet files (oms-status/docker/setup.sh)"
    echo "  init grafana config with the slack token (vim oms-monitor/docker/config/gf-provisioning/notifiers/conf.yml)"
    echo "  init prometheus scraping config with the basic auth (vim oms-monitor/docker/config/prometheus.yml)"
}

# change passwords (currently deploy.sh [calls an external script])
# FIRST DEPLOYMENT
pw_changer ()
{
    echo -e "\n[Deployment] Setting passwords\n"
    bash ${DIR}/password-setter.sh
}

# wrapper for the compose mess (ACCEPTS PARAMETERS)
compose_wrapper ()
{ #TO DO: put hostname check and do not accept the nuke and stop in production
    service_string=$(printenv ENABLED_SERVICES)
    services=(${service_string//:/ })
    command="docker-compose -f ${DIR}/base-docker-compose.yml"
    for s in "${services[@]}"; do
        if [[ -f "${DIR}/${s}/docker/docker-compose.yml" ]]; then
            if [[ "${MYAEGEE_ENV}" == "production" ]]; then
              command="${command} -f ${DIR}/${s}/docker/docker-compose.yml"
            else
              command="${command} -f ${DIR}/${s}/docker/docker-compose.yml -f ${DIR}/${s}/docker/docker-compose.dev.yml"
            fi
        else
            echo -e "[MyAEGEE] WARNING: No docker file found for ${s} (full path ${DIR}/${s}/docker/docker-compose.yml)"
        fi
    done
    command="${command} ${@}"
    if ( $verbose ); then
        echo -e "\n[MyAEGEE] Full command:\n${command}\n"
    fi
    eval ${command}
    return $?
}

# build it for the first time (currently Makefile that calls oms.sh [build])
# FIRST DEPLOYMENT
#compose_wrapper build

# launch it (currently Makefile that calls oms.sh [start])
# FIRST DEPLOYMENT
#compose_wrapper up -d

# update the running instance (build only - does not bump submodules) and relaunch (currently Makefile that calls oms.sh [live-refresh])
# THIS IS THE TARGET FOR AUTO DEPLOYMENTS
#compose_wrapper up -d --build

# edit the env file before launching
# FIRST DEPLOYMENT
edit_env_file ()
{
    export EDITOR=$(env | grep EDITOR | grep -oe '[^=]*$');
    if [ -z "${EDITOR}" ]; then
      echo "[Deployment] no EDITOR variable, setting it to vim"
      export EDITOR="vim";
    fi
    if ( ! ${NON_INTERACTIVE} ); then
        #Ask if one wants to tweak the .env before starting it up
        echo "Do you wish to edit .env file? (write the number)"
        select yn in "Yes" "No"; do
        case $yn in
            Yes ) ${EDITOR} ${DIR}/.env; break;;
            No ) break;;
        esac
        done
    fi
}

# nuke the installation (currently both deploy AND makefile launching both oms.sh [nuke])
# (has a security check, near the end)
# compose_wrapper down -v

# show logs (even if NOW they go to logstash)
#compose_wrapper logs -f #and additional args: the names of the containers, after -f
#FIXME: with the make target, it cannot follow specific logs

# execute command
#compose_wrapper exec #and additional args: the name of the container and the command
#FIXME: with the make target, arguments cannot be specified

# HUMAN INTERVENTION NEEDED: register in .env your services
## Export all environment variables from .env to this script in case we need them some time
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ ! -f ${DIR}/.env ]; then
    cp ${DIR}/.env.example ${DIR}/.env
fi
export $(cat ${DIR}/.env | grep -v ^# | xargs)
if [[ "${MYAEGEE_ENV}" != "production" && "${MYAEGEE_ENV}" != "development" ]]; then
  echo "Error: MYAEGEE_ENV can only be 'production' or 'development'"
  exit 1
fi
export HOSTNAME="$(hostname)"

# Entry: check if the number of arguments is max 2 (one for the target one for the verbose)
init=false;
build=false;
start=false;
refresh=false;
monitor=false;
stop=false;
down=false;
restart=false;
nuke=false;
bump=false;
bumpmodules=false;
execute=false;
debug=false;
list=false;
pull=false;
verbose=true; #TODO put me to false default
docker=false;
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
            --down) down=true; ((command_num++)); shift ;;
            --restart) restart=true; ((command_num++)); shift ;;
            --nuke) nuke=true; ((command_num++)); shift ;;
            --bump) bump=true; ((command_num++)); shift ;;
            --bumpmodules) bumpmodules=true; ((command_num++)); shift ;;
            --execute) execute=true; ((command_num++)); shift ;;
            --debug) debug=true; ((command_num++)); shift ;;
            --list) list=true; ((command_num++)); shift ;;
            --pull) pull=true; ((command_num++)); shift ;;
            --docker) docker=true; ((command_num++)); shift ;;
            -v) verbose=true; shift ;;

            --) shift ; arguments+=$@; break ;;

            -*) echo "unknown option: $1" 2>&1;
                echo "Usage: helper.sh {--init|--build|--start|--refresh|--monitor|--stop|--down|--restart|--nuke|--execute|--bump|--docker} [-v]"; exit 1;;
            *) arguments+="$1 "; shift;;
        esac
    done

else
    echo "Too few parameters"; exit 1
    echo "Usage: helper.sh {--init|--build|--start|--refresh|--monitor|--stop|--down|--restart|--nuke|--execute|--bump|--docker} [-v]"; exit 1
fi

if (( $command_num > 1 )); then
    echo "Too many commands! Only one command per time"
    echo "Usage: helper.sh {--init|--build|--start|--refresh|--monitor|--stop|--down|--restart|--nuke|--execute|--bump|--docker} [-v]"; exit 1
fi

if ( $init ); then
    init_boot && NON_INTERACTIVE=true; edit_env_file && pw_changer
fi

if ( $build ); then
    compose_wrapper config > current-config.yml && compose_wrapper build
    exit $?
fi

if ( $start ); then
    compose_wrapper config > current-config.yml && compose_wrapper up -d $arguments
    exit $?
fi

if ( $refresh ); then #THIS IS AN UPGRADING, i.e. CD pipeline target
    compose_wrapper config > current-config.yml && compose_wrapper up -d --build
    exit $?
fi

if ( $monitor ); then
    compose_wrapper logs -f --tail=100 $arguments
    exit $?
fi

if ( $execute ); then
    compose_wrapper exec $arguments
    exit $?
fi

if ( $pull ); then
    compose_wrapper pull $arguments
    exit $?
fi

if ( $debug ); then
    compose_wrapper config | tee would-be-config.yml
    exit $?
fi

if ( $list ); then
    compose_wrapper ps
    exit $?
fi

if ( $stop ); then
  if [[ ! -z $arguments ]]; then #IF NOT EMPTY, continue: we only want this command to be used for a single container
    compose_wrapper stop $arguments #TODO: improve robustness. if there is rubbish it is still not empty
    exit $?
  fi
  echo "'Stop' must only be used with a container name"
  exit 0
fi

if ( $down ); then
  if [[ ! -z $arguments ]]; then #IF NOT EMPTY, continue: we only want this command to be used for a single container
    compose_wrapper down $arguments #TODO: improve robustness. if there is rubbish it is still not empty
    exit $?
  fi
  echo "'Down' must only be used with a container name"
  exit 0
fi

if ( $restart ); then
  if [[ ! -z $arguments ]]; then #IF NOT EMPTY, continue: we only want this command to be used for a single container
    compose_wrapper restart $arguments #TODO: improve robustness. if there is rubbish it is still not empty
    exit $?
  fi
  echo "'Restart' must only be used with a container name"
  exit 0
fi

if ( $nuke ); then
  if [[ "$(hostname)" == *prod* ]]; then
    echo "DUUUDE you can't kill production" && exit 1;
  else
      compose_wrapper down -v
      exit $?
  fi
fi

if ( $bump ); then
    bump_repo
fi

if ( $bumpmodules ); then
    bump_nocommit
fi

if ( $docker ); then
    compose_wrapper $arguments
    exit $?
fi

#return 0;


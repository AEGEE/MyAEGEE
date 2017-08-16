#!/bin/bash

echo -e "USAGE: bash ./oms.sh [--no-up | --build | [--down | --down_v] | --push]\n";

# Default settings
UP=YES
BUILD=NO
DOWN=NO
DOWN_V=NO
PUSH=NO

#Parse input
for i in "$@"
do
case $i in
    --no-up)
    UP=NO
    shift # past argument=value
    ;;
    --build)
    BUILD=YES
    shift # past argument=value
    ;;
    --down)
    DOWN=YES
    shift # past argument=value
    ;;
    --down_v)
    DOWN_V=YES
    shift # past argument=value
    ;;
    --push)
    PUSH=YES
    shift # past argument=value
    ;;
    *)
            # unknown option
    ;;
esac
done

#Display input
echo -e "UP            (--no-up)       = ${UP}"
echo -e "BUILD         (--build)       = ${BUILD}"
echo -e "DOWN          (--down)        = ${DOWN}"
echo -e "DOWN_V        (--down_v)      = ${DOWN_V}"
echo -e "PUSH          (--push)        = ${PUSH}"


#
## Script
#


echo -e "OMS: Create network..."
docker network create OMS

## Declare docker-compose.yml folders
declare -a arr=("docker" "oms-core/docker")

## Save base path
BASE_PATH=$(pwd)

## now loop through the above array
for i in "${arr[@]}"
do
    echo -e "OMS: Process folder...  $i"
    cd $i
    [ "$DOWN" == "YES" ] && docker-compose down
    [ "$DOWN_V" == "YES" ] && docker-compose down -v
    [ "$BUILD" == "YES" ] && docker-compose build --force-rm --no-cache
    [ "$PUSH" == "YES" ] && docker-compose push
    [ "$UP" == "YES" ] && docker-compose up -d
    cd $BASE_PATH
done

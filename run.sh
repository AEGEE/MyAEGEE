#!/bin/bash

echo -e "USAGE: bash ./run.sh [--no-up | --build | [--down  --down_v] | -c=?]\n";

# Default settings
UP=YES
BUILD=NO
DOWN=NO
DOWN_V=NO
CONTAINER=

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
    -c=*)
    CONTAINER="${i#*=}"
    shift # past argument=value
    ;;
    *)
            # unknown option
    ;;
esac

done
echo -e "UP            (--no-up)       = ${UP}"
echo -e "BUILD         (--build)       = ${BUILD}"
echo -e "DOWN          (--down)        = ${DOWN}"
echo -e "DOWN_V        (--down_v)      = ${DOWN_V}"

echo -e "CONTAINER     (-c=?)          = ${CONTAINER}"



docker network create OMS
cd docker/
[ "$DOWN" == "YES" ] && docker-compose down
[ "$DOWN_V" == "YES" ] && docker-compose down -v
[ "$BUILD" == "YES" ] && docker-compose build --force-rm --no-cache $CONTAINER
[ "$UP" == "YES" ] && docker-compose up -d $CONTAINER
cd ../oms-core/docker
[ "$DOWN" == "YES" ] && docker-compose down
[ "$DOWN_V" == "YES" ] && docker-compose down -v
[ "$BUILD" == "YES" ] && docker-compose build --force-rm $CONTAINER
[ "$UP" == "YES" ] && docker-compose up -d $CONTAINER

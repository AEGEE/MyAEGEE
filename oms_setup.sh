#!/bin/bash
# FROM: https://stackoverflow.com/questions/192249/how-do-i-parse-command-line-arguments-in-bash

echo -e "USAGE: bash ./oms_setup.sh [[-c=? | -t=? | --push] | --reset]\n";

# Default settings
CONTAINER=stable
PUSH=NO
TAG=dev
RESET=NO

for i in "$@"
do
case $i in
    -c=*|--container=*)
    CONTAINER="${i#*=}"
    shift # past argument=value
    ;;
    --push)
    PUSH=YES
    shift # past argument=value
    ;;
    --reset)
    RESET=YES
    shift # past argument=value
    ;;
    -t=*|--tag=*)
    TAG="${i#*=}"
    shift # past argument=value
    ;;
    *)
            # unknown option
    ;;
esac

done
echo -e "CONTAINER     (-c=?)          = ${CONTAINER}"
echo -e "PUSH          (--push)        = ${PUSH}"
echo -e "TAG           (-t=?)          = ${TAG}"
echo -e "RESET         (--reset)       = ${RESET}\n\n"


if [ "$RESET" == "YES" ]; then
    echo -e "###\n###### RESETTING _ALL_ DOCKER CONTAINERS + IMAGES\n###\n\n"

    docker stop $(docker ps -aq)
    docker rm $(docker ps -aq)
    docker rmi $(docker images -a)
    exit 0
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "mongoui" ]; then
    echo -e "###\n###### Building container: mongoui \n###"
    docker build -t mongoui -f ./oms-globals/docker/mongoui/Dockerfile.$TAG ./oms-globals/docker/mongoui || exit 10
    docker tag mongoui aegee/mongoui:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: mongoui \n###"
        docker push aegee/mongoui:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsapplications" ]; then
    echo -e "###\n###### Building container: omsapplications \n###"
    docker build -t omsapplications -f ./omsapplications/docker/Dockerfile.$TAG ./omsapplications/docker || exit 10
    docker tag omsapplications aegee/omsapplications:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: omsapplications \n###"
        docker push aegee/omsapplications:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsapplications-frontend" ]; then
    echo -e "###\n###### Building container: omsapplications-frontend \n###"
    docker build -t omsapplications-frontend -f ./omsapplications-frontend/docker/Dockerfile.$TAG ./omsapplications-frontend/docker || exit 10
    docker tag omsapplications-frontend aegee/omsapplications-frontend:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: omsapplications-frontend \n###"
        docker push aegee/omsapplications-frontend:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "stable" ] || [ "$CONTAINER" == "omscore" ]; then
    echo -e "###\n###### Building container: omscore \n###"
    docker build -t omscore -f ./oms-core/docker/omscore/Dockerfile.$TAG ./oms-core/docker/omscore || exit 10
    docker tag omscore aegee/omscore:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: omscore \n###"
        docker push aegee/omscore:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "stable" ] || [ "$CONTAINER" == "omscore-nginx" ]; then
    echo -e "###\n###### Building container: omscore-nginx \n###"
    docker build -t omscore-nginx -f ./oms-core/docker/omscore-nginx/Dockerfile.$TAG ./oms-core/docker/omscore-nginx || exit 10
    docker tag omscore-nginx aegee/omscore-nginx:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: omscore-nginx \n###"
        docker push aegee/omscore-nginx:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsevents" ]; then
    echo -e "###\n###### Building container: omsevents \n###"
    docker build -t omsevents -f ./oms-events/docker/Dockerfile.$TAG ./oms-events/docker || exit 10
    docker tag omsevents aegee/omsevents:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: omsevents \n###"
        docker push aegee/omsevents:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsevents-frontend" ]; then
    echo -e "###\n###### Building container: omsevents-frontend \n###"
    docker build -t omsevents-frontend -f ./oms-events-frontend/docker/Dockerfile.$TAG ./oms-events-frontend/docker || exit 10
    docker tag omsevents-frontend aegee/omsevents-frontend:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: omsevents-frontend \n###"
        docker push aegee/omsevents-frontend:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsserviceregistry" ]; then
    echo -e "###\n###### Building container: omsserviceregistry \n###"
    docker build -t omsserviceregistry -f ./omsserviceregistry/docker/Dockerfile.$TAG ./omsserviceregistry/docker || exit 10
    docker tag omsserviceregistry aegee/omsserviceregistry:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: omsserviceregistry \n###"
        docker push aegee/omsserviceregistry:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "stable" ] || [ "$CONTAINER" == "php-fpm" ]; then
    echo -e "###\n###### Building container: php-fpm \n###"
    docker build -t php-fpm -f ./oms-core/docker/php-fpm/Dockerfile.$TAG ./oms-core/docker/php-fpm || exit 10
    docker tag php-fpm aegee/php-fpm:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: php-fpm \n###"
        docker push aegee/php-fpm:$TAG || exit 12
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "stable" ] || [ "$CONTAINER" == "traefik" ]; then
    echo -e "###\n###### Building container: traefik \n###"
    docker build -t traefik -f ./oms-globals/docker/traefik/Dockerfile.$TAG ./oms-globals/docker/traefik || exit 10
    docker tag traefik aegee/traefik:$TAG || exit 11
    if [ "$PUSH" == "YES" ]; then
        echo -e "###\n###### Pushing container: traefik \n###"
        docker push aegee/traefik:$TAG || exit 12
    fi
fi

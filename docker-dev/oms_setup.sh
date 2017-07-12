#!/bin/bash

# FROM: https://stackoverflow.com/questions/192249/how-do-i-parse-command-line-arguments-in-bash

# Default settings
CONTAINER=stable
PUSH=NO
TAG=dev

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
    -t=*|--tag=*)
    TAG="${i#*=}"
    shift # past argument=value
    ;;
    *)
            # unknown option
    ;;
esac

done
echo "CONTAINER     (-c=?)      = ${CONTAINER}"
echo "PUSH          (--push)    = ${PUSH}"
echo "TAG           (-t=?)      = ${TAG}"

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "mongoui" ]; then
    echo "---- Building mongoui ----"
    docker build -t mongoui -f ./mongoui/Dockerfile.$TAG ./mongoui
    docker tag mongoui aegee/mongoui:$TAG
    if [ "$PUSH" == "YES"]; then
        echo "---- Pushing mongoui ----"
        docker push aegee/mongoui:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsapplications" ]; then
    echo "---- Building omsapplications ----"
    docker build -t omsapplications -f ./omsapplications/Dockerfile.$TAG ./omsapplications
    docker tag omsapplications aegee/omsapplications:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Pushing omsapplications ----"
        docker push aegee/omsapplications:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsapplications-frontend" ]; then
    echo "---- Building omsapplications-frontend ----"
    docker build -t omsapplications-frontend -f ./omsapplications-frontend/Dockerfile.$TAG ./omsapplications-frontend
    docker tag omsapplications-frontend aegee/omsapplications-frontend:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Pushing omsapplications-frontend ----"
        docker push aegee/omsapplications-frontend:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "stable" ] || [ "$CONTAINER" == "omscore" ]; then
    echo "---- Building omscore ----"
    docker build -t omscore -f ./omscore/Dockerfile.$TAG ./omscore
    docker tag omscore aegee/omscore:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Building omscore ----"
        docker push aegee/omscore:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "stable" ] || [ "$CONTAINER" == "omscore-nginx" ]; then
    echo "---- Building omscore-nginx ----"
    docker build -t omscore-nginx -f ./omscore-nginx/Dockerfile.$TAG ./omscore-nginx
    docker tag omscore-nginx aegee/omscore-nginx:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Building omscore-nginx ----"
        docker push aegee/omscore-nginx:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsevents" ]; then
    echo "---- Building omsevents ----"
    docker build -t omsevents -f ./omsevents/Dockerfile.$TAG ./omsevents
    docker tag omsevents aegee/omsevents:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Building omsevents ----"
        docker push aegee/omsevents:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsevents-frontend" ]; then
    echo "---- Building omsevents-frontend ----"
    docker build -t omsevents-frontend -f ./omsevents-frontend/Dockerfile.$TAG ./omsevents-frontend
    docker tag omsevents-frontend aegee/omsevents-frontend:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Building omsevents-frontend ----"
        docker push aegee/omsevents-frontend:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "omsserviceregistry" ]; then
    echo "---- Building omsserviceregistry ----"
    docker build -t omsserviceregistry -f ./omsserviceregistry/Dockerfile.$TAG ./omsserviceregistry
    docker tag omsserviceregistry aegee/omsserviceregistry:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Building omsserviceregistry ----"
        docker push aegee/omsserviceregistry:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "stable" ] || [ "$CONTAINER" == "php-fpm" ]; then
    echo "---- Building php-fpm ----"
    docker build -t php-fpm -f ./php-fpm/Dockerfile.$TAG ./php-fpm
    docker tag php-fpm aegee/php-fpm:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Building php-fpm ----"
        docker push aegee/php-fpm:$TAG
    fi
fi

if [ "$CONTAINER" == "all" ] || [ "$CONTAINER" == "stable" ] || [ "$CONTAINER" == "traefik" ]; then
    echo "---- Building traefik ----"
    docker build -t traefik -f ./traefik/Dockerfile.$TAG ./traefik
    docker tag traefik aegee/traefik:$TAG
    if [ "$PUSH" == "YES" ]; then
        echo "---- Building traefik ----"
        docker push aegee/traefik:$TAG
    fi
fi

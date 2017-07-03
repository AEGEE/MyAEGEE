#!/bin/bash

#docker login

echo "---- Building mongoui ----"
docker build -t mongoui -f ./mongoui/Dockerfile.dev ./mongoui
docker tag mongoui aegee/mongoui:dev
docker push aegee/mongoui:dev

echo "---- Building omsapplications ----"
docker build -t omsapplications -f ./omsapplications/Dockerfile.dev ./omsapplications
docker tag omsapplications aegee/omsapplications:dev
docker push aegee/omsapplications:dev

echo "---- Building omsapplications-frontend ----"
docker build -t omsapplications-frontend -f ./omsapplications-frontend/Dockerfile.dev ./omsapplications-frontend
docker tag omsapplications-frontend aegee/omsapplications-frontend:dev
docker push aegee/omsapplications-frontend:dev

echo "---- Building omscore ----"
docker build -t omscore -f ./omscore/Dockerfile.dev ./omscore
docker tag omscore aegee/omscore:dev
docker push aegee/omscore:dev

echo "---- Building omscore-nginx ----"
docker build -t omscore-nginx -f ./omscore-nginx/Dockerfile.dev ./omscore-nginx
docker tag omscore-nginx aegee/omscore-nginx:dev
docker push aegee/omscore-nginx:dev

echo "---- Building omsevents ----"
docker build -t omsevents -f ./omsevents/Dockerfile.dev ./omsevents
docker tag omsevents aegee/omsevents:dev
docker push aegee/omsevents:dev

echo "---- Building omsevents-frontend ----"
docker build -t omsevents-frontend -f ./omsevents-frontend/Dockerfile.dev ./omsevents-frontend
docker tag omsevents-frontend aegee/omsevents-frontend:dev
docker push aegee/omsevents-frontend:dev

echo "---- Building omsserviceregistry ----"
docker build -t omsserviceregistry -f ./omsserviceregistry/Dockerfile.dev ./omsserviceregistry
docker tag omsserviceregistry aegee/omsserviceregistry:dev
docker push aegee/omsserviceregistry:dev

echo "---- Building php-fpm ----"
docker build -t php-fpm -f ./php-fpm/Dockerfile.dev ./php-fpm
docker tag php-fpm aegee/php-fpm:dev
docker push aegee/php-fpm:dev

echo "---- Building traefik ----"
docker build -t traefik -f ./traefik/Dockerfile.dev ./traefik
docker tag traefik aegee/traefik:dev
docker push aegee/traefik:dev
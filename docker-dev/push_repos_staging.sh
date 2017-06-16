#!/bin/bash

#docker login

echo "---- Building omsapplications ----"
docker build -t omsapplications -f ./omsapplications/Dockerfile.stage ./omsapplications
docker tag omsapplications aegee/omsapplications:staging
docker push aegee/omsapplications:staging

echo "---- Building omsapplications-frontend ----"
docker build -t omsapplications-frontend -f ./omsapplications-frontend/Dockerfile.stage ./omsapplications-frontend
docker tag omsapplications-frontend aegee/omsapplications-frontend:staging
docker push aegee/omsapplications-frontend:staging

echo "---- Building omscore ----"
docker build -t omscore -f ./omscore/Dockerfile.stage ./omscore
docker tag omscore aegee/omscore:staging
docker push aegee/omscore:staging

echo "---- Building omscore-nginx ----"
docker build -t omscore-nginx -f ./omscore-nginx/Dockerfile.stage ./omscore-nginx
docker tag omscore-nginx aegee/omscore-nginx:staging
docker push aegee/omscore-nginx:staging

echo "---- Building omsevents ----"
docker build -t omsevents -f ./omsevents/Dockerfile.stage ./omsevents
docker tag omsevents aegee/omsevents:staging
docker push aegee/omsevents:staging

echo "---- Building omsevents-frontend ----"
docker build -t omsevents-frontend -f ./omsevents-frontend/Dockerfile.stage ./omsevents-frontend
docker tag omsevents-frontend aegee/omsevents-frontend:staging
docker push aegee/omsevents-frontend:staging

echo "---- Building omsserviceregistry ----"
docker build -t omsserviceregistry -f ./omsserviceregistry/Dockerfile.stage ./omsserviceregistry
docker tag omsserviceregistry aegee/omsserviceregistry:staging
docker push aegee/omsserviceregistry:staging

echo "---- Building php-fpm ----"
docker build -t php-fpm -f ./php-fpm/Dockerfile.dev ./php-fpm
docker tag php-fpm aegee/php-fpm:staging
docker push aegee/php-fpm:staging

echo "---- Building traefik ----"
docker build -t traefik -f ./traefik/Dockerfile.dev ./traefik
docker tag traefik aegee/traefik:staging
docker push aegee/traefik:staging
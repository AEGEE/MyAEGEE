#!/bin/bash

#docker login

echo "---- Building mongoui ----"
docker build -t mongoui -f ./mongoui/Dockerfile.dev ./mongoui
docker tag mongoui aegee/mongoui:dev
docker push aegee/mongoui:dev

echo "---- Building traefik ----"
docker build -t traefik -f ./traefik/Dockerfile.dev ./traefik
docker tag traefik aegee/traefik:dev
docker push aegee/traefik:dev
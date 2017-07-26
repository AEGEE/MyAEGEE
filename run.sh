#!/bin/bash

docker network create OMS
cd docker/
docker-compose down -v
docker-compose up -d
cd ../oms-core/docker
docker-compose down -v
docker-compose up -d

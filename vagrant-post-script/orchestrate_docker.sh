#!/bin/bash

cd oms-docker/docker
docker-compose up -d
echo "############# ok until here"
docker-compose logs -f omscore-bootstrap
docker-compose logs -f omsevents-bootstrap
echo "############# done"

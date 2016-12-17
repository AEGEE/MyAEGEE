#!/bin/bash

cd oms-docker/docker
docker-compose up -d
echo "############# ok until here"
docker-compose exec -T omscore bash /root/bootstrap.sh

sleep 3
cat /home/vagrant/oms-docker/oms-core/storage/key > /home/vagrant/oms-docker/docker/api-key

docker-compose exec -T omsevents bash /root/bootstrap.sh

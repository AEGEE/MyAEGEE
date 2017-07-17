#!/bin/bash

echo -e "###\n### Deploying OMS...\n###"
cd oms-docker/docker
docker-compose down -v
cd ../../
rm -Rf oms-docker
echo "Finished cleanup"
git clone --recursive --branch dev https://github.com/AEGEE/oms-docker.git
cp ./oms-core.env oms-docker/oms-core/example.env
cp ./oms-core_UserSeeder.php oms-docker/oms-core/database/seeds/UserSeeder.php
echo "Finished setting up files"
cd oms-docker/docker
docker-compose up -d
echo "System initializing..."
echo "Exit logs by pressing ctrl+c, the server kees running"
docker-compose logs -f

#!/bin/bash

# Move this file 1 level above the oms-docker installation!

echo -e "###\n### Deploying OMS...\n###"
if [ $(grep ADMIN_PASSWORD ./oms-core.env) == "ADMIN_PASSWORD=1234" ]; then
  echo "ERROR: Please do not use the default ADMIN_PASSWORD in ./oms-core.env"
  exit 9
fi
cd oms-docker/docker
docker-compose down -v
cd ../../
rm -Rf oms-docker
echo -e "\nFinished cleanup\n"

git clone --recursive --branch dev https://github.com/AEGEE/oms-docker.git
cp ./oms-core.env oms-docker/oms-core/.env.example
echo -e "\nFinished setting up files\n"

cd oms-docker/docker
docker-compose up -d
echo -e "\nInitializing..."
echo -e "This might take a while"
sleep 5
echo -e "Logs will be shown, you can press ctrl+c at any time (without stopping the server)\n"
sleep 10
docker-compose logs -f

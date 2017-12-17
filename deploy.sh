#!/bin/bash

# Move this file 1 level above the oms-docker installation!
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "###\n### Deploying OMS...\n###"
if [ $(grep ADMIN_PASSWORD $DIR/oms-core.env) == "ADMIN_PASSWORD=admin" ]; then
  echo "ERROR: Please do not use the default ADMIN_PASSWORD in ./oms-core.env"
  exit 9
fi
bash $DIR/oms-docker/oms.sh down -v
rm -Rf oms-docker
bash docker stop $(docker ps -aq)
bash docker rmi $(docker images -a)
echo -e "\nFinished cleanup\n"

git clone --recursive --branch master https://github.com/AEGEE/oms-docker.git
cp $DIR/oms-core.env $DIR/oms-docker/oms-core/.env.example
echo -e "\nFinished setting up files\n"

bash $DIR/oms-docker/oms.sh up -d
echo -e "\nInitializing..."
echo -e "This might take a while"
sleep 5
echo -e "Use 'bash ./oms-docker/oms.sh logs -f' to show the log"

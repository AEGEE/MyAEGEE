#!/bin/bash

#taken from https://docs.docker.com/engine/installation/linux/ubuntulinux/

echo "###################     Installing docker from script file"

curl -L https://github.com/docker/compose/releases/download/1.9.0/docker-compose-$(uname -s)-$(uname -m) > ~/docker-compose
sudo mv ~/docker-compose /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

sudo apt-get install -y git vim

#checking if the repo has been cloned or downloaded through zip 
if [ ! -f /home/vagrant/oms-docker/oms-core/composer.json ]; then
    echo "###################     repository was downloaded zipped, or dcloned not recursively"
    git clone -b dev --recursive https://github.com/AEGEE/oms-docker.git fixme
    rsync --remove-source-files -av fixme/ oms-docker/
    rm -rf fixme
else
    echo "###################     repository was cloned --recursively"
fi

echo "###################     now installation as per the instruction of the readme"
sleep 5

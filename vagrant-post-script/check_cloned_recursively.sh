#!/bin/bash

#checking if the repo has been cloned or downloaded through zip 
if [ ! -f /vagrant/oms-core/composer.json ]; then
    echo "[Vagrant] ###################     repository was downloaded zipped, or cloned not recursively"
    git clone --recursive https://github.com/AEGEE/oms-docker.git fixme
    rsync --remove-source-files --ignore-existing -auq --progress /home/vagrant/fixme/ /vagrant/
    rm -rf /home/vagrant/fixme
else
    echo "[Vagrant] ###################     repository was cloned --recursively"
fi

echo "[Vagrant] ###################     now going to the bootstrapping"
sleep 5

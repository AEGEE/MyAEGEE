#!/bin/bash

#checking if the repo has been cloned or downloaded through zip 
if [ ! -f /home/ubuntu/oms-docker/oms-core/composer.json ]; then
    echo "[Vagrant] ###################     repository was downloaded zipped, or cloned not recursively"
    git clone --recursive https://github.com/AEGEE/oms-docker.git fixme
    rsync --remove-source-files -av fixme/ oms-docker/
    rm -rf fixme
else
    echo "[Vagrant] ###################     repository was cloned --recursively"
fi

echo "[Vagrant] ###################     now going to the bootstrapping"
sleep 5

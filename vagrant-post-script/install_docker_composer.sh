#!/bin/bash

#taken from https://docs.docker.com/engine/installation/linux/ubuntulinux/

echo "[Vagrant] ###################     Installing docker-composer from script file"

if [ -a /usr/local/bin/docker-compose ]; then echo "[Vagrant] ###################     docker-compose already installed, exiting"; exit; fi

curl -L "https://github.com/docker/compose/releases/download/1.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

sudo chmod +x /usr/local/bin/docker-compose


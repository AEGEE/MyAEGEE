#!/bin/bash

sudo dpkg -l | grep docker && { echo "[Vagrant] ###################     Docker already installed, exiting"; exit; }

echo "[Vagrant] ###################     Installing docker"

sudo apt-get update > /dev/null

sudo apt-get install -qq -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

sudo apt-key fingerprint 0EBFCD88 || { echo "[Vagrant] ###################     Fingerprint error, exiting"; exit; }

sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"

sudo apt-get update > /dev/null
sudo apt-get install -qq -y docker-ce=17.06.0~ce-0~ubuntu || { echo "[Vagrant] ###################     Installation error, exiting"; exit; }

echo "[Vagrant] ###################     Installation complete"


#!/bin/bash

echo "[Vagrant] ###################     Installing make because apparently it's not standard no more??"
sudo apt-get install -y make

echo "[Vagrant] ###################     Installing jq"
sudo apt-get install -y jq

echo "[Vagrant] ###################     Installing net-tools"
sudo apt-get install -y net-tools

echo "[Vagrant] ###################     Installing vim"
sudo apt-get install -y vim

echo "[Vagrant] ###################     Installing sqlite3"
sudo apt-get install -y sqlite3

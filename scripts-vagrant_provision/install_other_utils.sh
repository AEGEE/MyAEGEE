#!/bin/bash

echo "[Vagrant] ###################     Installing make because apparently it's not standard no more??"
sudo apt-get install -y make > /dev/null

echo "[Vagrant] ###################     Installing jq"
sudo apt-get install -y jq > /dev/null

echo "[Vagrant] ###################     Installing net-tools"
sudo apt-get install -y net-tools > /dev/null

echo "[Vagrant] ###################     Installing vim"
sudo apt-get install -y vim > /dev/null

echo "[Vagrant] ###################     Installing sqlite3"
sudo apt-get install -y sqlite3 > /dev/null

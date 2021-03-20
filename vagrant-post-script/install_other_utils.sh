#!/bin/bash

echo "[Vagrant] ###################     Installing nvm"
curl -sS -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash

echo "[Vagrant] ###################     Installing make because apparently it's not standard no more??"
sudo apt-get install -y make

echo "[Vagrant] ###################     Installing jq"
sudo apt-get install -y jq

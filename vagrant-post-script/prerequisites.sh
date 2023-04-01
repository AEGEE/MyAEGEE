#!/bin/bash

sudo apt-get update
sudo apt-get install curl -y

echo "[Vagrant] ###################     Installing node tooling for frontend and backend"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm install 16
nvm use 16
sudo npm install -g npx

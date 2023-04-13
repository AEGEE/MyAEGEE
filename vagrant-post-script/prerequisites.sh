#!/bin/bash

sudo apt-get update
sudo apt-get install curl -y

NODE_VERSION=16
NPM_VERSION=9.6.4

echo "[Vagrant] ###################     Installing node tooling for frontend and backend"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
npm install -g npm@"$NPM_VERSION"

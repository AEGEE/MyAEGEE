#!/bin/bash

sudo apt-get update > /dev/null
# For NVM
sudo apt-get install -y curl > /dev/null
# For pyenv
sudo apt-get install -y git build-essential libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev libncursesw5-dev xz-utils tk-dev libffi-dev liblzma-dev python-openssl > /dev/null

NODE_VERSION=16
NPM_VERSION=9.6.4
PYTHON_VERSION=3.10.3

echo "[Vagrant] ###################     Installing node tooling for frontend and backend"
sudo apt-get remove nodejs npm
node --version || echo "no node (good)"
npm --version || echo "no npm (good)"

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
npm install -g npm@"$NPM_VERSION"

# To mock the backup directory on the server
sudo mkdir /opt/myaegee
sudo mkdir /opt/backups
sudo chown vagrant:vagrant /opt/myaegee
sudo chown vagrant:vagrant /opt/backups

## Install python via pyenv
git clone https://github.com/pyenv/pyenv.git ~/.pyenv

export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
if command -v pyenv 1>/dev/null 2>&1; then
  eval "$(pyenv init -)"
fi

pyenv install "${PYTHON_VERSION}"
pyenv global "${PYTHON_VERSION}"
pip install -r /vagrant/scripts-vagrant_provision/requirements.txt

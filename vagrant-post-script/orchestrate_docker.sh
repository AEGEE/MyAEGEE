#!/bin/bash

cd /vagrant/
git reset --hard HEAD
#./helper.sh --bumpmodules
make bootstrap
sleep 120 #to give time for the bootstrap

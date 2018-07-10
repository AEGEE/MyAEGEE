#!/bin/bash

#Ping OMS-core

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

sudo apt-get install python-setuptools
sudo easy_install pip
sudo pip install json-spec httpie
echo "Setup done."
rm -f $DIR/response.json
#OMS-CORE
#http localhost:7000/campaigns > $DIR/response.json
#echo "Got response from core, checking..."
#json validate --schema-file=$DIR/schema.json < $DIR/response.json && echo "Valid response!" || exit 1
#OMS-EVENTS
#http localhost:7000/campaigns > $DIR/response.json
#echo "Got response from events, checking..."
#json validate --schema-file=$DIR/schema.json < $DIR/response.json && echo "Valid response!" || exit 1
echo "wahooo"

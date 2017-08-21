#!/bin/bash

#Ping OMS-core

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

sudo apt-get install python-setuptools
sudo easy_install pip
sudo pip install json-spec
echo "Setup done."
rm -f $DIR/response.json
curl -X POST -H "Content-Type:application/json" localhost/api/login > $DIR/response.json
echo "Got response, checking..."
json validate --schema-file=$DIR/schema.json < $DIR/response.json && echo "Valid response!"

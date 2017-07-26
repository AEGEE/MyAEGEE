#!/bin/bash

#Ping OMS-core

sudo apt-get install python-setuptools
sudo easy_install pip
sudo pip install json-spec
echo "Setup done."
rm -f response.json
curl -X POST -H "Content-Type:application/json" localhost/api/login > response.json
echo "Got response, checking..."
json validate --schema-file=schema.json < response.json && echo "Valid response!"

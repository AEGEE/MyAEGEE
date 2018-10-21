#!/bin/bash

if [ ! -f lib/config/configFile.json ]
then
  cp lib/config/configFile.json.example lib/config/configFile.json
fi

npm install --loglevel warn

#!/bin/bash

if [ ! -f config/configFile.json ]
then
  cp config/configFile.json.example config/configFile.json
fi

echo "Installing packages..."
npm install --loglevel warn
echo "Creating database..."
npm run db:create
echo "Migrating database..."
npm run db:migrate
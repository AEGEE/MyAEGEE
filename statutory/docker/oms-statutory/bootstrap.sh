#!/bin/bash

if [ ! -f config/config.json ]
then
  cp config/config.json.example config/config.json
fi

echo "Installing packages..."
npm install --loglevel warn
echo "Creating database..."
npm run db:create
echo "Migrating database..."
npm run db:migrate
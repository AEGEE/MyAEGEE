#!/bin/bash

if [ ! -f config/index.js ]
then
  cp config/index.js.example config/index.js
fi

echo "Creating database..."
npm run db:create
echo "Migrating database..."
npm run db:migrate

#!/bin/sh

npm install
npm run build
chmod 777 /usr/app/src
nginx

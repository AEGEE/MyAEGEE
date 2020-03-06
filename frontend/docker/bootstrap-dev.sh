#!/bin/sh

apk add nodejs npm
npm install
npm run build
chmod -R 777 /usr/app/src/
nginx

#!/bin/sh

npm install #FIXME: in nginx image there is no npm
npm run build #FIXME: in nginx image there is no npm
chmod -R 777 /usr/app/src/
nginx

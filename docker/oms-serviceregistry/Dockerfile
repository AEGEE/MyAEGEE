FROM node:7

RUN npm install -g supervisor

WORKDIR /usr/src/app
CMD npm install && supervisor -e 'node,js,json' /usr/src/app/index.js


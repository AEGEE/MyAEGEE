FROM node:7

RUN npm install -g supervisor bunyan

RUN mkdir -p /usr/app/ && mkdir -p /usr/scripts && mkdir -p /usr/shared

WORKDIR /usr/app
ENV PORT=8085
CMD npm install && supervisor -e 'node,js,json' /usr/app/lib/server.js | bunyan

EXPOSE 8085
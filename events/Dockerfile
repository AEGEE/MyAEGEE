FROM node:7

RUN npm install -g supervisor bunyan

RUN mkdir -p /usr/app/frontend && mkdir -p /usr/app/media && mkdir -p /usr/scripts && mkdir -p /usr/shared

WORKDIR /usr/app/oms-events

CMD npm install

CMD supervisor -e 'node,js,json' /usr/app/oms-events/lib/server.js | bunyan

EXPOSE 8082
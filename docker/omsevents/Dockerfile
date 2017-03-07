FROM node:7

RUN npm install -g supervisor bunyan

RUN mkdir -p /usr/app/ && mkdir -p /usr/app/frontend && mkdir -p /usr/app/media && mkdir -p /usr/scripts && mkdir -p /usr/shared

WORKDIR /usr/app

RUN npm install -g bunyan supervisor

ADD ./start.sh /usr/scripts/start.sh

CMD sh /usr/scripts/start.sh

EXPOSE 8082
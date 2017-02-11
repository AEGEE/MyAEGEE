FROM node:7

RUN npm install -g supervisor bunyan

RUN mkdir -p /usr/app/
RUN mkdir -p /usr/app/frontend
RUN mkdir -p /usr/app/events
RUN mkdir -p /usr/scripts
RUN mkdir -p /usr/shared

WORKDIR /usr/app

RUN npm install -g bunyan
RUN npm install -g supervisor

ADD ./start.sh /usr/scripts/start.sh

CMD sh /usr/scripts/start.sh

EXPOSE 8082
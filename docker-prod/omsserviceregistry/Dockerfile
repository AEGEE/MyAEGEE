FROM node:7

RUN npm install -g supervisor bunyan

RUN mkdir -p /usr/src/shared

RUN git clone https://github.com/AEGEE/oms-serviceregistry.git /usr/src/app

ADD https://raw.githubusercontent.com/AEGEE/oms-docker/master/docker/docker-compose.yml /usr/src/docker-compose.yml


WORKDIR /usr/src/app

RUN npm install

CMD supervisor -e 'node,js,json' /usr/src/app/index.js | bunyan

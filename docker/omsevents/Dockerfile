FROM node:7

RUN npm install -g supervisor bunyan

RUN mkdir -p /usr/src/shared

###UNTIL HERE SAME AS SERVICEREGISTRY
#WORKDIR /usr/src/app

RUN mkdir -p /usr/app/ \
        && mkdir -p /usr/app/frontend \
        && mkdir -p /usr/app/media \
        && mkdir -p /usr/scripts \
        && mkdir -p /usr/shared

WORKDIR /usr/app

RUN git clone https://github.com/AEGEE/oms-events.git 


ADD ./start.sh /usr/scripts/start.sh
ADD ./configFile.json /usr/scripts/configFile.json

RUN cp /usr/scripts/configFile.json /usr/app/oms-events/lib/config/configFile.json \
    && cd /usr/app/oms-events \
    && npm install


CMD supervisor -e 'node,js,json' /usr/app/oms-events/lib/server.js | bunyan

EXPOSE 8082

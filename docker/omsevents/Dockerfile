FROM node:7

RUN apt-get update
RUN npm install -g supervisor bunyan

RUN mkdir -p /usr/src/frontend
WORKDIR /usr/src/
RUN mv -r ./oms-events/frontend ./frontend
WORKDIR oms-events
ADD ./configFile.json /usr/src/oms-events/lib/config/configFile.json

ARG FRONTEND_IP
RUN sed -i 's/FRONTEND_IP/${FRONTEND_IP}/g' /usr/src/oms-events/lib/config/configFile.json

CMD supervisor src/server.js | bunyan

EXPOSE 8082
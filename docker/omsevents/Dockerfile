FROM node:7

RUN npm install -g supervisor bunyan

RUN mkdir -p /usr/app/
RUN mkdir -p /usr/app/frontend
RUN mkdir -p /usr/app/events

WORKDIR /usr/app
# Would be cool to not having to download that this way...
ADD https://raw.githubusercontent.com/AEGEE/oms-events/dev/package.json /usr/app/package.json
ADD ./boostrap.sh /root/bootstrap.sh

RUN npm install

CMD supervisor /usr/app/oms-events/lib/server.js | bunyan

EXPOSE 8082
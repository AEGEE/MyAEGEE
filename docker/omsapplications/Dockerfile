FROM node:7

RUN npm install -g supervisor bunyan

RUN git clone https://github.com/AEGEE/oms-applications /usr/app
RUN mkdir -p /usr/scripts && mkdir -p /usr/shared

WORKDIR /usr/app
ENV PORT=8085

RUN npm install
CMD supervisor -e 'node,js,json' /usr/app/lib/server.js | bunyan

EXPOSE 8085

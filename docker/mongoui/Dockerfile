FROM node:7

WORKDIR /
RUN git clone https://github.com/mrvautin/adminMongo.git && cd adminMongo && npm i
COPY ./app.json /adminMongo/config/app.json
COPY ./config.json /adminMongo/config/config.json
WORKDIR /adminMongo
EXPOSE 3000
CMD npm start
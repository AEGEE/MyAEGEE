FROM node:12

RUN mkdir -p /usr/app/src \
	&& mkdir -p /usr/app/media \
	&& mkdir -p /usr/app/scripts

COPY --chown=node:node package.json /usr/app/src

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

RUN npm install -g --loglevel warn nodemon bunyan && npm cache clean --force
RUN npm install --loglevel warn

COPY . /usr/app/src

RUN chown -R node:node /usr/app

USER node

COPY ./docker/network/bootstrap.sh /usr/app/scripts/bootstrap.sh

CMD sh /usr/app/scripts/bootstrap.sh && npm start

EXPOSE 8084

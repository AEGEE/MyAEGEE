# FIXME use alpine
FROM node@sha256:14f0471d0478fbb9177d0f9e8c146dc872273dcdcfc7fea93a27ed81fc6b0e96

RUN mkdir -p /usr/app/src \
	&& mkdir -p /usr/app/media \
	&& mkdir -p /usr/app/scripts

COPY ./docker/core/bootstrap.sh /usr/app/scripts/bootstrap.sh
COPY . /usr/app/src

RUN mkdir /usr/app/src/state \
	&& chown -R node:node /usr/app

WORKDIR /usr/app/src

USER node

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

# FIXME remove nodemon for production
RUN npm install -g nodemon@2.0.19 \
 && npm install -g bunyan@1.8.15 \
 && npm cache clean --force \
 && npm ci

CMD sh /usr/app/scripts/bootstrap.sh && nodemon -e "js,json" lib/run.js

EXPOSE 8084

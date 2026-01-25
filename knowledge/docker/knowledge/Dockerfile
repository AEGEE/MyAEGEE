# FIXME use alpine
FROM node:25.4.0

RUN mkdir -p /usr/app/src \
	&& mkdir -p /usr/app/media \
	&& mkdir -p /usr/app/scripts

COPY ./docker/knowledge/bootstrap.sh /usr/app/scripts/bootstrap.sh
COPY . /usr/app/src

RUN chown -R node:node /usr/app

WORKDIR /usr/app/src

USER node

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

# FIXME remove nodemon for production
RUN npm install -g nodemon@3.1.4 \
 && npm install -g bunyan@1.8.15 \
 && npm cache clean --force \
 && npm install --legacy-peer-deps

CMD ["sh", "-c", "sh /usr/app/scripts/bootstrap.sh && nodemon -e js,json lib/run.js"]

EXPOSE 8084

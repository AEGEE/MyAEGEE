FROM node:16.13.0

WORKDIR /usr/app/src

COPY --chown=node:node package.json /usr/app/src

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

RUN npm install --loglevel warn

COPY . /usr/app/src

RUN chown -R node:node /usr/app

USER node

ENTRYPOINT ["npm"]
CMD ["start"]

EXPOSE 8084

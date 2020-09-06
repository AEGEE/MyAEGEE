FROM node:12

WORKDIR /usr/app/src

COPY . /usr/app/src

RUN chown -R node:node /usr/app

USER node

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

RUN npm install --loglevel warn

ENTRYPOINT ["npm"]
CMD ["start"]

EXPOSE 8084

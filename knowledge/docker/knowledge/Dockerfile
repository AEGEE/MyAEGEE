# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM node:22-alpine

RUN mkdir -p /usr/app/src \
 && mkdir -p /usr/app/media \
 && mkdir -p /usr/app/scripts

WORKDIR /usr/app/src

# Copy bootstrap script first (rarely changes)
COPY ./docker/knowledge/bootstrap.sh /usr/app/scripts/bootstrap.sh

# Inject version from CI if provided (defaults to whatever is in package.json)
ARG PACKAGE_VERSION

# Copy only dependency manifests first to maximise layer caching.
# Rebuilds that only change source code will skip the npm ci step.
COPY package.json package-lock.json ./
RUN if [ -n "$PACKAGE_VERSION" ]; then npm version "$PACKAGE_VERSION" --no-git-tag-version --allow-same-version; fi \
 && npm ci --legacy-peer-deps

# Now copy the rest of the source
COPY . .

RUN chown -R node:node /usr/app

USER node

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

# FIXME remove nodemon for production
RUN npm install -g nodemon@3.1.4 \
 && npm install -g bunyan@1.8.15 \
 && npm cache clean --force

CMD ["sh", "-c", "sh /usr/app/scripts/bootstrap.sh && nodemon -e js,json lib/run.js"]

EXPOSE 8084

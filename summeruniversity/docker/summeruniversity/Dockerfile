# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5

RUN mkdir -p /usr/app/src /usr/app/media/headimages /usr/app/scripts \
 && chown -R node:node /usr/app

WORKDIR /usr/app/src

# Copy bootstrap script first (rarely changes)
COPY --chown=node:node ./docker/summeruniversity/bootstrap.sh /usr/app/scripts/bootstrap.sh

# Copy only dependency manifests first to maximise layer caching.
# Rebuilds that only change source code will skip the npm ci step.
COPY --chown=node:node package.json package-lock.json ./

USER 1000

RUN npm ci --legacy-peer-deps --omit=dev

# Now copy the rest of the source
COPY --chown=node:node . .

# Inject version from CI if provided (defaults to whatever is in package.json).
# This has to come after `COPY . .`, which would otherwise overwrite package.json again.
ARG PACKAGE_VERSION
RUN if [ -n "$PACKAGE_VERSION" ]; then npm pkg set version="$PACKAGE_VERSION"; fi

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

# FIXME remove nodemon for production
RUN npm install -g nodemon@3.1.4 \
 && npm install -g bunyan@1.8.15 \
 && npm cache clean --force

CMD ["sh", "-c", "sh /usr/app/scripts/bootstrap.sh && npm run nodemon-start"]

EXPOSE 8084

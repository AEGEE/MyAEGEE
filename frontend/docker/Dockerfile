# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS builder

WORKDIR /usr/app/src

# Copy only dependency manifests first to maximise layer caching.
# Rebuilds that only change source code will skip the npm ci step.
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare \
 && npm ci --legacy-peer-deps --omit=dev

# Now copy the rest of the source and build
COPY . .

# Inject version from CI if provided (defaults to whatever is in package.json).
# This has to come after `COPY . .`, which would otherwise overwrite package.json again.
ARG PACKAGE_VERSION
RUN if [ -n "$PACKAGE_VERSION" ]; then npm pkg set version="$PACKAGE_VERSION"; fi \
 && npm run build

# ------- dev server stage -------
# Only used without Traefik (MYAEGEE_GATEWAY=devserver, see docker-compose.devserver.yml):
# the source is bind-mounted and node_modules lives in a named volume, so this
# stage has no build steps of its own. Not part of the default (runtime) target.
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS devserver

WORKDIR /usr/app/src
# A new named volume copies this directory's owner, so npm can install as `node`.
RUN mkdir -p node_modules && chown -R node:node /usr/app
# The `node` user
USER 1000

EXPOSE 8080
CMD ["sh", "docker/devserver/start.sh"]

# ------- runtime stage -------
# Multi-platform nginx for ARM64 and AMD64
FROM nginx:1.31.8-alpine@sha256:fed7e14be83cbd2661a75cdc5b872d936cf155d46c327084d30b8df19ae88d72

# Remove default config that displays the nginx welcome page
RUN rm -rf /etc/nginx/conf.d \
 && adduser -D -H -u 1000 -s /bin/sh www-data -G www-data

# Copy only the built static assets — not node_modules or source code
COPY --from=builder /usr/app/src/dist /usr/app/src/dist

COPY ./docker/frontend-nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./docker/frontend-nginx/sites/default.conf /etc/nginx/sites-available/default.conf

RUN chown -R www-data:www-data /usr/app/

WORKDIR /usr/app/src/dist

EXPOSE 80
CMD ["nginx"]

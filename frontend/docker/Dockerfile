# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

WORKDIR /usr/app/src

# Inject version from CI if provided (defaults to whatever is in package.json)
ARG PACKAGE_VERSION

# Copy only dependency manifests first to maximise layer caching.
# Rebuilds that only change source code will skip the npm ci step.
COPY package.json package-lock.json ./
RUN if [ -n "$PACKAGE_VERSION" ]; then npm version "$PACKAGE_VERSION" --no-git-tag-version --allow-same-version; fi \
 && npm pkg delete scripts.prepare \
 && npm ci --legacy-peer-deps --omit=dev

# Now copy the rest of the source and build
COPY . .
RUN npm run build

# ------- runtime stage -------
# Multi-platform nginx for ARM64 and AMD64
FROM nginx:1.29.8-alpine

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

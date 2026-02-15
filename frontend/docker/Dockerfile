# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /usr/app/src

# Copy only dependency manifests first to maximise layer caching.
# Rebuilds that only change source code will skip the npm ci step.
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare \
 && npm ci --legacy-peer-deps --omit=dev

# Now copy the rest of the source and build
COPY . .
RUN npm run build

# ------- runtime stage -------
# Multi-platform nginx for ARM64 and AMD64
FROM --platform=$TARGETPLATFORM nginx:1.27.3-alpine

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

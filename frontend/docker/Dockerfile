# FIXME use alpine
FROM node:18.18.0 AS builder

COPY . /usr/app/src
WORKDIR /usr/app/src

RUN npm pkg delete scripts.prepare \
 && npm ci --omit=dev \
 && npm run build

FROM nginx:1.27.3-alpine

RUN adduser -D -H -u 1000 -s /bin/bash www-data -G www-data

COPY --from=builder /usr/app/src /usr/app/src
COPY ./docker/frontend-nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./docker/frontend-nginx/sites/default.conf /etc/nginx/sites-available/default.conf

# it has some default settings there which result in displaying
# the default nginx page, which is not what we need
RUN rm -rf /etc/nginx/conf.d \
 && apk --no-cache add curl=8.11.1-r0 \
 && chown -R www-data:www-data /usr/app/

WORKDIR /usr/app/src/dist
#USER www-data ?????/
EXPOSE 8083
CMD ["nginx"]

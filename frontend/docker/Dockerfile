FROM node:12.10.0-alpine AS builder

COPY . /usr/app/src
WORKDIR /usr/app/src

RUN npm install
RUN npm run build

FROM nginx:1.17.0-alpine

RUN adduser -D -H -u 1000 -s /bin/bash www-data -G www-data

COPY --from=builder /usr/app/src /usr/app/src
COPY ./docker/oms-frontend-nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./docker/oms-frontend-nginx/sites/default.conf /etc/nginx/sites-available/default.conf

# it has some default settings there which result in displaying
# the default nginx page, which is not what we need
RUN rm -rf /etc/nginx/conf.d

RUN apk add curl

RUN chown -R www-data:www-data /usr/app/

WORKDIR /usr/app/src/dist
#USER www-data ?????/
EXPOSE 8083
CMD ["nginx"]

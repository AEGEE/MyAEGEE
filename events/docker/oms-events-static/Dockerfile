FROM nginx:1.17.0-alpine

RUN mkdir -p /usr/app/src
WORKDIR /usr/app/src

RUN apk add curl

RUN adduser -D -H -u 1000 -s /bin/bash www-data -G www-data

COPY ./docker/oms-events-static/status.json /usr/app/status.json
COPY ./docker/oms-events-static/nginx.conf /etc/nginx/nginx.conf
COPY ./docker/oms-events-static/sites/default.conf /etc/nginx/sites-available/default.conf

# it has some default settings there which result in displaying
# the default nginx page, which is not what we need
RUN rm -rf /etc/nginx/conf.d
RUN chmod 755 -R /usr/app/

WORKDIR /usr/app/media
EXPOSE 80
CMD ["nginx"]

FROM nginx:alpine

ADD nginx.conf /etc/nginx/
COPY sites/*.conf /etc/nginx/sites-available/

RUN apk update \
    && apk upgrade \
    && apk add --no-cache bash \
    && adduser -D -H -u 1000 -s /bin/bash www-data \
    && rm /etc/nginx/conf.d/default.conf 

CMD ["nginx"]

EXPOSE 8086

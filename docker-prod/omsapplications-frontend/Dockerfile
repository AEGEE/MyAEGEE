FROM nginx:alpine

RUN apk update \
    && apk upgrade \
    && apk add --no-cache bash git \
    && adduser -D -H -u 1000 -s /bin/bash www-data \
    && rm /etc/nginx/conf.d/default.conf 

RUN mkdir -p /usr/app/ \
        && mkdir -p /usr/app/frontend \
        && mkdir -p /usr/app/media \
        && mkdir -p /usr/scripts \
        && mkdir -p /usr/shared

WORKDIR /usr/app

RUN git clone https://github.com/AEGEE/oms-applications-frontend.git frontend

ADD ./nginx.conf /etc/nginx/
COPY ./sites/*.conf /etc/nginx/sites-available/

CMD ["nginx"]

EXPOSE 8086

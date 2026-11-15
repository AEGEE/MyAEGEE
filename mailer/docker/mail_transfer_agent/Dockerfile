# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
#MAINTAINER Uri Savelchev <alterrebe@gmail.com>

# Packages: update
RUN apk --no-cache add postfix ca-certificates libsasl py3-jinja2

# Add files
COPY docker/mail_transfer_agent/conf /root/conf
RUN mkfifo /var/spool/postfix/public/pickup \
    && ln -s /etc/postfix/aliases /etc/aliases

COPY docker/mail_transfer_agent/bin/render-template.py /usr/local/bin/

# Runner
COPY docker/mail_transfer_agent/run.sh /root/run.sh
RUN chmod +x /root/run.sh

# Declare
EXPOSE 25

CMD ["ash", "/root/run.sh"]

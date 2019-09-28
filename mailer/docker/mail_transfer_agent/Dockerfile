FROM alpine:3.8
#MAINTAINER Uri Savelchev <alterrebe@gmail.com>

# Packages: update
RUN apk --no-cache add postfix ca-certificates libsasl py-pip supervisor rsyslog
RUN pip install j2cli

# Add files
COPY conf /root/conf
RUN mkfifo /var/spool/postfix/public/pickup \
    && ln -s /etc/postfix/aliases /etc/aliases

# Configure: supervisor
COPY bin/dfg.sh /usr/local/bin/
COPY conf/supervisor-all.ini /etc/supervisor.d/

# Runner
COPY run.sh /root/run.sh
RUN chmod +x /root/run.sh

# Declare
EXPOSE 25

CMD ["ash", "/root/run.sh"]

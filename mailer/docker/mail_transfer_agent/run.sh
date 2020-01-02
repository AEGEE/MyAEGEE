#!/bin/bash

if [ -z "$SMTP_USER" ]
then
  echo '$SMTP_USER is not set'
  exit -1
fi

if [ -z "$SMTP_PASSWORD" ]
then
  echo '$SMTP_PASSWORD is not set'
  exit -1
fi

if [ -z "$SMTP_HOST" ]
then
  echo '$SMTP_HOST is not set'
  exit -1
fi

#! /usr/bin/env ash
set -e # exit on error

# Variables
export SMTP_LOGIN=${SMTP_USER}
export SMTP_PASSWORD=${SMTP_PASSWORD}
export EXT_RELAY_HOST=${SMTP_HOST}
export EXT_RELAY_PORT=${SMTP_PORT:-"587"}
export RELAY_HOST_NAME=${RELAY_HOST_NAME:-"my.aegee.eu"}
export ACCEPTED_NETWORKS=${ACCEPTED_NETWORKS:-"192.168.0.0/16 172.16.0.0/12 10.0.0.0/8"}
export USE_TLS=${USE_TLS:-"yes"}
export TLS_VERIFY=${TLS_VERIFY:-"may"}

echo $RELAY_HOST_NAME > /etc/mailname

# Templates
j2 /root/conf/postfix-main.cf > /etc/postfix/main.cf
j2 /root/conf/sasl_passwd > /etc/postfix/sasl_passwd
postmap /etc/postfix/sasl_passwd

# Launch
rm -f /var/spool/postfix/pid/*.pid
exec /usr/bin/supervisord -n -c /etc/supervisord.conf
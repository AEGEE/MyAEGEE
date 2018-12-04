#!/bin/bash

user=$(cat /var/run/secrets/mail_user)
password=$(cat /var/run/secrets/mail_password)

if [ -z "$user" ]
then
  echo "Username secret not set"
  exit -1
fi

if [ -z "$password" ]
then
  echo "Password secret not set"
  exit -1
fi

#echo "[mail.aegee.org]:587 ${user}:${password}" > /etc/postfix/sasl_passwd

#postmap /etc/postfix/sasl_passwd

export EXT_RELAY_HOST=mail.aegee.org
export EXT_RELAY_PORT=587
export SMTP_LOGIN=$user
export SMTP_PASSWORD=$password
export RELAY_HOST_NAME=my.aegee.eu

sh /run.sh
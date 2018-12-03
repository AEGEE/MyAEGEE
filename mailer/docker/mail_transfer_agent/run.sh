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

export SMTP_SERVER=mail.aegee.org
export SMTP_PORT=587
export SMTP_USERNAME=$user
export SMTP_PASSWORD=$password
export SERVER_HOSTNAME=my.aegee.eu

sh /run.sh
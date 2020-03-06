#!/bin/bash

CURDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

## Create secrets
echo -e "[OMS] Creating random secrets if not existing (est. 50')"

## Create a new random jwt key
if ! [[ -f "${CURDIR}/../secrets/jwt_key" ]]; then
  mkdir -p ${CURDIR}/../secrets
  echo -e "[OMS] Creating jwt_key"
  #cat /dev/random | head -c 256 | base64 > ${CURDIR}/../secrets/jwt_key
  echo "5ecr3t" > ${CURDIR}/../secrets/jwt_key
fi

## Will not result in a valid sendgrid key but at least allows starting of the docker-compose stack
if ! [[ -f "${CURDIR}/../secrets/sendgrid_key" ]]; then
  mkdir -p ${CURDIR}/../secrets
  echo -e "[OMS] Creating sendgrid_key"
  #cat /dev/random | head -c 256 | base64 > ${CURDIR}/../secrets/sendgrid_key
  echo "5ecr3t" > ${CURDIR}/../secrets/sendgrid_key
fi

if ! [[ -f "${CURDIR}/../secrets/mail_user" ]]; then
  mkdir -p ${CURDIR}/../secrets
  echo -e "[OMS] Creating mail_user"
  #cat /dev/random | head -c 256 | base64 > ${CURDIR}/../secrets/sendgrid_key
  echo "aegee" > ${CURDIR}/../secrets/mail_user
fi

if ! [[ -f "${CURDIR}/../secrets/mail_password" ]]; then
  mkdir -p ${CURDIR}/../secrets
  echo -e "[OMS] Creating mail_password"
  #cat /dev/random | head -c 256 | base64 > ${CURDIR}/../secrets/sendgrid_key
  echo "5ecr3t" > ${CURDIR}/../secrets/mail_password
fi

if ! [[ -f "${CURDIR}/../secrets/db_password" ]]; then
  mkdir -p ${CURDIR}/../secrets
  echo -e "[OMS] Creating db_password"
  #cat /dev/random | head -c 256 | base64 > ${CURDIR}/../secrets/sendgrid_key
  echo "5ecr3t" > ${CURDIR}/../secrets/db_password
fi

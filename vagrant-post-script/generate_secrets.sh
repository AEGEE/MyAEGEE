#!/bin/bash

CURDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

## Create secrets
echo -e "[MyAEGEE] Creating *very* random secrets if not existing"

## Create a new random jwt key
if ! [[ -f "${CURDIR}/../secrets/jwt_key" ]]; then
  mkdir -p "${CURDIR}/../secrets"
  echo -e "[MyAEGEE] Creating jwt_key"
  echo "5ecr3t" > "${CURDIR}/../secrets/jwt_key"
fi

## Will not result in a valid sendgrid key but at least allows starting of the docker-compose stack
if ! [[ -f "${CURDIR}/../secrets/sendgrid_key" ]]; then
  mkdir -p "${CURDIR}/../secrets"
  echo -e "[MyAEGEE] Creating sendgrid_key"
  echo "5ecr3t" > "${CURDIR}/../secrets/sendgrid_key"
fi

if ! [[ -f "${CURDIR}/../secrets/mail_user" ]]; then
  mkdir -p "${CURDIR}/../secrets"
  echo -e "[MyAEGEE] Creating mail_user"
  echo "aegee" > "${CURDIR}/../secrets/mail_user"
fi

if ! [[ -f "${CURDIR}/../secrets/mail_password" ]]; then
  mkdir -p "${CURDIR}/../secrets"
  echo -e "[MyAEGEE] Creating mail_password"
  echo "5ecr3t" > "${CURDIR}/../secrets/mail_password"
fi

if ! [[ -f "${CURDIR}/../secrets/db_password" ]]; then
  mkdir -p "${CURDIR}/../secrets"
  echo -e "[MyAEGEE] Creating db_password"
  echo "5ecr3t" > "${CURDIR}/../secrets/core-db_password"
fi

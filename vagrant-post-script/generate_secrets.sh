#!/bin/bash

CURDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

## Create secrets
echo -e "[OMS] Creating random secrets if not existing (est. 50')"

## Create a new random jwt key
if ! [[ -f "$CURDIR/../secrets/jwt_key" ]]; then
  mkdir -p $CURDIR/../secrets
  echo -e "[OMS] Creating jwt_key"
  cat /dev/random | head -c 256 | base64 > $CURDIR/../secrets/jwt_key
fi

## Will not result in a valid sendgrid key but at least allows starting of the docker-compose stack
if ! [[ -f "$CURDIR/../secrets/sendgrid_key" ]]; then
  mkdir -p $CURDIR/../secrets
  echo -e "[OMS] Creating sendgrid_key"
  cat /dev/random | head -c 256 | base64 > $CURDIR/../secrets/sendgrid_key
fi

## If no certificate is provided, use a self-signed one
if ! [[ -f "$CURDIR/../secrets/cert.pem" ]]; then
  mkdir -p $CURDIR/../secrets
  echo -e "[OMS] Creating cert.pem"
  openssl req -x509 -newkey rsa:4096 -keyout $CURDIR/../secrets/key.pem -out $CURDIR/../secrets/cert.pem -days 365 -nodes -batch
fi

## If no acme.json is there, make it
if ! [[ -f "$CURDIR/../secrets/acme.json" ]]; then
  mkdir -p $CURDIR/../secrets
  touch $CURDIR/../secrets/acme.json
  chmod 600 $CURDIR/../secrets/acme.json
fi

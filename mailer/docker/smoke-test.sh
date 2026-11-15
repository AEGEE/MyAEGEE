#!/bin/sh
# End-to-end check of the mail path: builds the mailer and mail-transfer-agent
# images and relays through a Mailpit SMTP server that, like production,
# requires STARTTLS and SMTP authentication with the configured credentials.
# One mail with two recipients is sent through the mailer API and both must
# arrive. The unit tests use Bamboo's test adapter, so they don't catch a
# broken SMTP path (for example a dependency that no longer works on the
# Erlang/OTP version of the image, or a relay/auth misconfiguration).
#
# Usage: sh mailer/docker/smoke-test.sh   (needs Docker)
set -eu

cd "$(dirname "$0")/.."

RUN_ID="mailer-smoke-$$"
NETWORK="$RUN_ID"
CERTS_VOLUME="$RUN_ID-certs"
MAILER="$RUN_ID-mailer"
MTA="$RUN_ID-mta"
MAILPIT="$RUN_ID-mailpit"
MAILER_IMAGE="$RUN_ID-mailer-image"
MTA_IMAGE="$RUN_ID-mta-image"
MAILPIT_IMAGE="axllent/mailpit:v1.33"
CURL_IMAGE="curlimages/curl:8.11.1"
SMTP_USER="mailer@aegee.eu"
SMTP_PASSWORD="smoke-test-password"

cleanup() {
    status=$?
    if [ "$status" -ne 0 ]; then
        echo "--- mailer logs"; docker logs "$MAILER" 2>&1 | tail -n 40 || true
        echo "--- mail-transfer-agent logs"; docker logs "$MTA" 2>&1 | tail -n 40 || true
    fi
    docker rm -f "$MAILER" "$MTA" "$MAILPIT" >/dev/null 2>&1 || true
    docker network rm "$NETWORK" >/dev/null 2>&1 || true
    docker volume rm "$CERTS_VOLUME" >/dev/null 2>&1 || true
    docker rmi "$MAILER_IMAGE" "$MTA_IMAGE" >/dev/null 2>&1 || true
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

curl_in_network() {
    docker run --rm --network "$NETWORK" "$CURL_IMAGE" -s --max-time 10 "$@"
}

docker build -t "$MAILER_IMAGE" -f docker/mailer/Dockerfile .
docker build -t "$MTA_IMAGE" -f docker/mail_transfer_agent/Dockerfile .

docker network create "$NETWORK" >/dev/null
docker volume create "$CERTS_VOLUME" >/dev/null
docker run --rm -v "$CERTS_VOLUME":/certs alpine:3.24 sh -c \
    'apk add --no-cache openssl >/dev/null && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=mailpit -keyout /certs/key.pem -out /certs/cert.pem 2>/dev/null'

docker run -d --name "$MAILPIT" --network "$NETWORK" -v "$CERTS_VOLUME":/certs:ro \
    -e MP_SMTP_AUTH="$SMTP_USER:$SMTP_PASSWORD" \
    -e MP_SMTP_TLS_CERT=/certs/cert.pem -e MP_SMTP_TLS_KEY=/certs/key.pem \
    -e MP_SMTP_REQUIRE_STARTTLS=true \
    "$MAILPIT_IMAGE" >/dev/null
# The mailer is configured to talk to a host called mail-transfer-agent.
docker run -d --name "$MTA" --network "$NETWORK" --network-alias mail-transfer-agent \
    -e SMTP_USER="$SMTP_USER" -e SMTP_PASSWORD="$SMTP_PASSWORD" \
    -e SMTP_HOST="$MAILPIT" -e SMTP_PORT=1025 \
    "$MTA_IMAGE" >/dev/null
docker run -d --name "$MAILER" --network "$NETWORK" \
    -e MIX_ENV=production -e SMTP_USER="$SMTP_USER" -e PORT=4000 \
    "$MAILER_IMAGE" >/dev/null

echo "Waiting for the mailer to become healthy..."
i=0
until curl_in_network -f "http://$MAILER:4000/healthcheck" >/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then echo "mailer did not become healthy"; exit 1; fi
    sleep 2
done

response=$(curl_in_network -X POST "http://$MAILER:4000/" \
    -H 'Content-Type: application/json' \
    -d '{"template":"confirm_email","parameters":{"token":"smoke","name":"Smoke Test"},"to":["one@example.org","two@example.org"],"subject":"Mailer smoke test","reply_to":"board@example.org"}')
echo "mailer response: $response"
echo "$response" | grep -q '"success":true'

echo "Waiting for the mails to arrive at the relay..."
i=0
until curl_in_network "http://$MAILPIT:8025/api/v1/messages" | grep -q '"total":2'; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then
        echo "expected 2 mails at the relay, got:"; curl_in_network "http://$MAILPIT:8025/api/v1/messages"
        exit 1
    fi
    sleep 2
done

messages=$(curl_in_network "http://$MAILPIT:8025/api/v1/messages")
for expected in one@example.org two@example.org board@example.org '"Subject":"Mailer smoke test"'; do
    if ! echo "$messages" | grep -q "$expected"; then
        echo "missing $expected in relayed mails: $messages"; exit 1
    fi
done

if ! docker logs "$MTA" 2>&1 | grep -q "TLS connection established to $MAILPIT"; then
    echo "mail-transfer-agent did not use TLS towards the relay"; exit 1
fi

echo "OK: both mails were relayed through mail-transfer-agent with STARTTLS and SMTP auth"

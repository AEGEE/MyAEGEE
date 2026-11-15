#!/bin/sh
# End-to-end check of the mail path: builds the mailer and mail-transfer-agent
# images, relays through a Mailpit SMTP server that requires authentication,
# sends one mail with two recipients through the mailer API and checks that
# both arrive. The unit tests use Bamboo's test adapter, so they don't catch a
# broken SMTP path (for example a dependency that no longer works on the
# Erlang/OTP version of the image).
#
# Usage: sh mailer/docker/smoke-test.sh   (needs Docker)
set -eu

cd "$(dirname "$0")/.."

NETWORK="mailer-smoke-$$"
MAILPIT_IMAGE="axllent/mailpit:v1.33"
CURL_IMAGE="curlimages/curl:8.11.1"

cleanup() {
    status=$?
    if [ "$status" -ne 0 ]; then
        echo "--- mailer logs"; docker logs mailer-smoke-mailer 2>&1 | tail -n 40 || true
        echo "--- mail-transfer-agent logs"; docker exec mail-transfer-agent tail -n 40 /var/log/messages 2>&1 || true
    fi
    docker rm -f mailer-smoke-mailer mail-transfer-agent mailer-smoke-mailpit >/dev/null 2>&1 || true
    docker network rm "$NETWORK" >/dev/null 2>&1 || true
    exit "$status"
}
trap cleanup EXIT

curl_in_network() {
    docker run --rm --network "$NETWORK" "$CURL_IMAGE" -s "$@"
}

docker build -t mailer-smoke-mailer -f docker/mailer/Dockerfile .
docker build -t mailer-smoke-mta -f docker/mail_transfer_agent/Dockerfile .

docker network create "$NETWORK" >/dev/null
docker run -d --name mailer-smoke-mailpit --network "$NETWORK" "$MAILPIT_IMAGE" \
    --smtp-auth-accept-any --smtp-auth-allow-insecure >/dev/null
# The mailer is configured to talk to a host called mail-transfer-agent.
docker run -d --name mail-transfer-agent --network "$NETWORK" \
    -e SMTP_USER=mailer@aegee.eu -e SMTP_PASSWORD=smoke-test \
    -e SMTP_HOST=mailer-smoke-mailpit -e SMTP_PORT=1025 \
    mailer-smoke-mta >/dev/null
docker run -d --name mailer-smoke-mailer --network "$NETWORK" \
    -e MIX_ENV=production -e SMTP_USER=mailer@aegee.eu -e PORT=4000 \
    mailer-smoke-mailer >/dev/null

echo "Waiting for the mailer to become healthy..."
i=0
until curl_in_network -f http://mailer-smoke-mailer:4000/healthcheck >/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then echo "mailer did not become healthy"; exit 1; fi
    sleep 2
done

response=$(curl_in_network -X POST http://mailer-smoke-mailer:4000/ \
    -H 'Content-Type: application/json' \
    -d '{"template":"confirm_email","parameters":{"token":"smoke","name":"Smoke Test"},"to":["one@example.org","two@example.org"],"subject":"Mailer smoke test","reply_to":"board@example.org"}')
echo "mailer response: $response"
echo "$response" | grep -q '"success":true'

echo "Waiting for the mails to arrive at the relay..."
i=0
until curl_in_network http://mailer-smoke-mailpit:8025/api/v1/messages | grep -q '"total":2'; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then
        echo "expected 2 mails at the relay, got:"; curl_in_network http://mailer-smoke-mailpit:8025/api/v1/messages
        exit 1
    fi
    sleep 2
done

messages=$(curl_in_network http://mailer-smoke-mailpit:8025/api/v1/messages)
for expected in one@example.org two@example.org board@example.org '"Subject":"Mailer smoke test"'; do
    if ! echo "$messages" | grep -q "$expected"; then
        echo "missing $expected in relayed mails: $messages"; exit 1
    fi
done

echo "OK: both mails were relayed through mail-transfer-agent"

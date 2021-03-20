#!/bin/bash

# ./notify.sh FAILURE
# ./notify.sh SUCCESS
STATUS="${1}"

SCRIPT_DIR=$(dirname "${0}")

#the 4 notifications:
# - slack
# - notifi
# - push on the phone
# - telegram

function slack_notifier(){
  SLACK_WEBHOOK_URL=$(jq .slack "${SCRIPT_DIR}"/../secrets/tokens.json | tr -d '"' )

  PICTURE="\"icon_emoji\": \":shipit:\""
  SLACK_USERNAME="Backup notifier"
  cat <<EOF > /tmp/attachment.txt
{
  "color": "#37FDFC",
  "author_name": "Host: $(hostname)",
  "title": "Backup result",
  "text": "The backup was a ${STATUS}",
  "fields": [
    {
      "title": "Completed at:",
      "value": "$(date +"%d %b %H:%M %Z")",
      "short": "false"
    }
  ],
  "footer": "Hope the backup is never needed",
  "fallback": "The backup was a ${STATUS}"
}
EOF

  ATTACHMENT=" \"attachments\": [$(cat /tmp/attachment.txt)]"
  PAYLOAD="payload={${ATTACHMENT}, ${PICTURE}, \"username\": \"${SLACK_USERNAME}\" }"
  STATUS_CODE=$(curl -sS -o /tmp/response.txt --write-out "%{http_code}" -X POST --data-urlencode "${PAYLOAD}" "${SLACK_WEBHOOK_URL}")
  if [[ "${STATUS_CODE}" -ne 200 ]] ; then
    echo "Slack webhook return '${STATUS_CODE}' error!"
    echo
    echo "Response:"
    cat /tmp/response.txt
    echo
    echo "Payload: ${PAYLOAD}"
    exit 1
  fi
  echo "Message sent to Slack!"
}

function notifi_notifier(){
  NOTIFI_TOKEN=$(jq .notifi "${SCRIPT_DIR}"/../secrets/tokens.json)

  curl -s \
        -d "credentials=${NOTIFI_TOKEN}" \
        -d "title=Backup completed" \
        -d "message=The backup was a ${STATUS}" \
        https://notifi.it/api
}

function pushme_notifier(){
  TOKEN=$(jq .pushme "${SCRIPT_DIR}"/../secrets/tokens.json)

  curl -s \
        -d "token=${TOKEN}" \
        -d "title=Backup completed" \
        -d "body=The backup was a ${STATUS}" \
      https://pushmeapi.jagcesar.se
}

function telegram_notifier(){
  echo "not yet"
}

slack_notifier
notifi_notifier
pushme_notifier
#telegram_notifier


# example of tokens.json:
# {
#   "slack": "123",
#   "notifi": "456",
#   "pushme": "789"
# }

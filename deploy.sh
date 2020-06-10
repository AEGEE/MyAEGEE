#!/bin/bash

export $(grep -v '^#' ".env" | xargs -d '\n')

if [[ "$#" -lt 1 ]]; then
    echo "Usage: ./deploy.sh <service-name>"
    exit 1
fi

SERVICE_NAME=$1

echo "Pulling $SERVICE_NAME..."
# shellcheck disable=SC2029
ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_FOLDER && ./helper.sh --pull $SERVICE_NAME"

echo "(Re)starting $SERVICE_NAME..."
# shellcheck disable=SC2029
ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_FOLDER && ./helper.sh --start $SERVICE_NAME"

echo "Sending a Slack notice..."
curl "$DEPLOY_TOKEN" -X POST -H 'Content-Type: application/json' --data-binary @- << EOF
{
    "attachments": [
        {
            "fallback": "The Docker image for \`$SERVICE_NAME\` was deployed to \`$DEPLOY_HOST\`.",
            "color": "#36a64f",
            "pretext": "The Docker image for \`$SERVICE_NAME\` was deployed to \`$DEPLOY_HOST\`.",
            "fields": [
                {
                    "title": "Service",
                    "value": "$SERVICE_NAME",
                    "short": false
                }
            ],
            "image_url": "http://my-website.com/path/to/image.jpg",
            "thumb_url": "http://example.com/path/to/thumb.png",
            "ts": $(date +%s)
        }
    ]
}
EOF

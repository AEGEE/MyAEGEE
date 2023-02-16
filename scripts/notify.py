#!/usr/bin/env python3

## usage:
# ./notify.py FAILURE
# ./notify.py SUCCESS

import os
import json
import sys
import datetime
import requests
from logsnag import LogSnag
import slack_notifications as slack


#the 4 notification channels:
# - slack
# - notifi (works for both iOS/Android but also MacOS and Linux)
# - push on the phone (via 'logsnag')
# - telegram (wip)

# example of tokens.json:
# {
#   "slack": "123",            # a single token
#   "notifi": ["456", "789"],  # an array of tokens
#   "logsnag": ["910", "111"]  # an array of tokens
# }


token_file = f'{os.path.realpath(os.path.dirname(__file__))}/../secrets/tokens.json'

def open_credentials_file():
    with open(token_file, encoding="utf-8") as tokens_json:
        return json.load(tokens_json)

tokens = open_credentials_file()


STATUS = sys.argv[1]
EVENT = f'The backup was a {STATUS}'

def slack_alert():
    api_key = tokens["slack"]

    slack.ACCESS_TOKEN = api_key

    attachment = slack.Attachment(
        title='Backup result',
        author_name=f'Host: {os.uname()[1]}',
        text=EVENT,
        footer='Hope the backup is never needed',
        color='#37FDFC' if STATUS == "SUCCESS" else "#FF5A36",
        fields=[
            slack.Attachment.Field(
                title='Completed at:',
                value=f'{datetime.datetime.now().strftime("%d %b %Y, %H:%M:%S %Z")}',
                short=False
            ),
        ],
    )

    slack.send_notify('----monitoring', icon_emoji=':shipit:', username='Backup notifier',
        attachments=[attachment])

def logsnag_alert():
    for key in tokens["logsnag"]:
        logsnag = LogSnag(token=key, project="command-centre") #FIXME: only works for fab

        icon = "🎉" if STATUS == "SUCCESS" else "❌"
        notify = bool(STATUS == "SUCCESS")

        logsnag.publish(
            channel="spare", #FIXME: only works for fab
            event=EVENT,
            icon=icon,
            notify=notify
        )

def notifi_alert():

    for token in tokens["notifi"]:
        response = requests.post('https://notifi.it/api', {
            'credentials': token,
            'title': EVENT,
            # one can also add 'message' 'link' and 'image'
        }, timeout=10)

    if response.status_code != 200:
        raise ConnectionError(response.status_code, response.text)

def telegram_alert():
    pass

if (STATUS in ["SUCCESS", "FAILURE"]):
    slack_alert()
    if STATUS == "FAILURE":
        logsnag_alert()
        notifi_alert()
        telegram_alert()

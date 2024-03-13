import os
import json
import datetime
import slack_notifications as slack


#the ?? notification channels:
# - slack
# - telegram (wip)

# example of tokens.json:
# {
#   "slack": "xoxb-123",            # a single token
#   "telegram": ["456", "789"],  # an array of tokens
# }

tokens = None
NOTIFY_CHANNEL = os.environ.get("NOTIFY_CHANNEL") or "----monitoring"

payload_nice = {
        "title": 'Something going on with the dispatcher',
        # "author_name": f'Host: {os.uname()[1]}',
        #"text": "REPLACEME",
        "footer": f'Error happened SOMETIME',
        "color": '#FF5A36',
        # "fields": [
        #     slack.Attachment.Field(
        #         title='Error happened at:',
        #         value=f'{datetime.datetime.now().strftime("%d %b %Y, %H:%M:%S %Z")}',
        #         short=False
        #     ),
        # ]
        }

def open_credentials_file():
    token_file = f'{os.path.realpath(os.path.dirname(__file__))}/../tokens.json'
    with open(token_file, encoding="utf-8") as tokens_json:
        return json.load(tokens_json)


def slack_alert(message_title, submessage = None):
    global tokens
    if tokens is None:
        tokens = open_credentials_file()
    api_key = tokens["slack"]

    slack.ACCESS_TOKEN = api_key

    payload_nice["title"] = f"Dispatcher says: {message_title}"
    payload_nice["footer"] = f'Error happened {datetime.datetime.now().strftime("%d %b %Y, %H:%M:%S %Z")}'
    if submessage:
        payload_nice["text"] = submessage

    attachment = slack.Attachment(
        **payload_nice
    )

    slack.send_notify(NOTIFY_CHANNEL, icon_emoji=':hole:', username='Dispatcher template notifier',
        attachments=[attachment])

if __name__ == "__main__":
    import sys
    tokens = open_credentials_file()
    EVENT = sys.argv[1]
    slack_alert(EVENT)

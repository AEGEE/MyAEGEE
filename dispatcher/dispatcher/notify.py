import os
import logging
import urllib.request
import urllib.error
import json

"""
Notification module using Apprise-API.

Sends notifications to a centralized Apprise service via HTTP POST.
Configure notification channels (Slack, Telegram, etc.) in the Apprise service,
not here. This module just sends the message.

Environment variables:
  APPRISE_URL  - Base URL of Apprise-API (default: http://apprise:8000)
  APPRISE_TAG  - Notification tag/channel (default: myaegee)
"""

APPRISE_URL = os.environ.get("APPRISE_URL", "http://apprise:8000")
APPRISE_TAG = os.environ.get("APPRISE_TAG", "myaegee")
NOTIFICATIONS_ENABLED = True


def notify(title, body, tag=None, notify_type="warning"):
    """
    Send a notification via Apprise-API.

    Args:
        title: Notification title
        body: Notification body/message
        tag: Override the default tag (optional)
        notify_type: One of: info, success, warning, failure (default: warning)
    """
    global NOTIFICATIONS_ENABLED

    if not NOTIFICATIONS_ENABLED:
        return False

    tag = tag or APPRISE_TAG
    url = f"{APPRISE_URL}/notify/{tag}"

    payload = {
        "title": title,
        "body": body,
        "type": notify_type,
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                logging.debug(f"Notification sent: {title}")
                return True
            else:
                logging.warning(f"Apprise returned status {response.status}")
                return False
    except urllib.error.URLError as e:
        logging.warning(f"Failed to send notification (Apprise unreachable): {e}")
        # Don't disable permanently - Apprise might come back
        return False
    except Exception as e:
        logging.warning(f"Failed to send notification: {e}")
        return False


# Backwards compatibility alias for existing code
def slack_alert(message_title, submessage=None):
    """
    Legacy function for backwards compatibility.
    Sends notification via Apprise-API instead of direct Slack.
    """
    body = submessage or message_title
    return notify(
        title=f"Dispatcher: {message_title}",
        body=body,
        notify_type="warning"
    )


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        message = " ".join(sys.argv[1:])
        notify("Test Notification", message)
        print(f"Sent: {message}")
    else:
        print("Usage: python notify.py <message>")

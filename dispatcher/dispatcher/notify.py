"""
Notification module using Apprise-API.

Sends notifications to a centralized Apprise service via HTTP POST.
Configure notification channels (Slack, Telegram, etc.) in the Apprise service,
not here. This module just sends the message.

Environment variables:
  APPRISE_URL              - Base URL of Apprise-API (default: http://apprise:8000)
  APPRISE_TAG              - Notification tag/channel (default: myaegee)
  NOTIFY_COOLDOWN_SECONDS  - Minimum seconds between notifications with the same key
                             (default: 300). Prevents alert storms when the same error
                             repeats across many queued messages.
"""

import json
import logging
import os
import time
import urllib.error
import urllib.request


APPRISE_URL = os.environ.get("APPRISE_URL", "http://apprise:8000")
APPRISE_TAG = os.environ.get("APPRISE_TAG", "myaegee")
NOTIFY_COOLDOWN_SECONDS = int(os.environ.get("NOTIFY_COOLDOWN_SECONDS", "300"))

# Per-key timestamp of the last successfully sent notification, used for throttling.
# Keys are derived from the notification title (or an explicit throttle_key if provided).
# This is an in-process dict — it resets on restart, which is acceptable: after a restart
# the cooldown window starts fresh and one notification will fire before throttling kicks in.
_last_notified: dict[str, float] = {}


def notify(title: str, body: str, tag: str | None = None,
           notify_type: str = "warning", throttle_key: str | None = None) -> bool:
    """
    Send a notification via Apprise-API.

    Args:
        title:        Notification title.
        body:         Notification body/message.
        tag:          Override the default Apprise tag (optional).
        notify_type:  One of: info, success, warning, failure (default: warning).
        throttle_key: Deduplication key for rate-limiting. Two calls with the same key
                      within NOTIFY_COOLDOWN_SECONDS will result in the second being
                      silently dropped. Defaults to `title` if not provided.
    """
    key = throttle_key or title
    now = time.monotonic()
    if now - _last_notified.get(key, 0.0) < NOTIFY_COOLDOWN_SECONDS:
        logging.debug(f"Notification throttled (cooldown active for key={key!r})")
        return False
    _last_notified[key] = now

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
            method="POST",
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
        return False
    except Exception as e:
        logging.warning(f"Failed to send notification: {e}")
        return False


def slack_alert(message_title: str, submessage: str | None = None) -> bool:
    """
    Backwards-compatibility alias.
    Originally sent to Slack directly; now routes through Apprise-API.
    The throttle key is the title so that repeated alerts for the same error
    (e.g. hundreds of queued messages hitting the same missing template) are collapsed.
    """
    body = submessage or message_title
    return notify(
        title=f"Dispatcher: {message_title}",
        body=body,
        notify_type="warning",
        throttle_key=message_title,
    )


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        message = " ".join(sys.argv[1:])
        notify("Test Notification", message)
        print(f"Sent: {message}")
    else:
        print("Usage: python notify.py <message>")

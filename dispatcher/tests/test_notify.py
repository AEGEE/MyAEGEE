"""notify and operator_alert: alerts through Apprise, throttled per title."""

import json
import urllib.error

import notify
import pytest


class Response:
    def __init__(self, status):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture
def requests(monkeypatch):
    sent = []
    outcome = {"status": 200, "raise": None}

    def urlopen(request, timeout):
        sent.append({"url": request.full_url, "method": request.get_method(), "timeout": timeout,
                     "headers": dict(request.header_items()), "payload": json.loads(request.data)})
        if outcome["raise"] is not None:
            raise outcome["raise"]
        return Response(outcome["status"])

    monkeypatch.setattr(notify.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(notify, "_last_notified", {})
    return sent, outcome


def test_notify_posts_json_to_the_apprise_tag(requests):
    sent, _ = requests

    assert notify.notify("Title", "Body", notify_type="failure") is True

    assert sent == [{
        "url": f"{notify.APPRISE_URL}/notify/{notify.APPRISE_TAG}",
        "method": "POST",
        "timeout": 10,
        "headers": {"Content-type": "application/json"},
        "payload": {"title": "Title", "body": "Body", "type": "failure"},
    }]


def test_notify_can_use_another_tag(requests):
    sent, _ = requests

    notify.notify("Title", "Body", tag="oncall")

    assert sent[0]["url"].endswith("/notify/oncall")


def test_the_same_notification_is_sent_once_within_the_cooldown(requests):
    sent, _ = requests

    assert notify.notify("Same", "1") is True
    assert notify.notify("Same", "2") is False
    assert notify.notify("Other", "3") is True
    assert notify.notify("Different title", "4", throttle_key="Same") is False

    assert [request["payload"]["body"] for request in sent] == ["1", "3"]


def test_the_cooldown_ends(requests, monkeypatch):
    sent, _ = requests
    clock = iter([1000.0, 1000.0 + notify.NOTIFY_COOLDOWN_SECONDS + 1])
    monkeypatch.setattr(notify.time, "monotonic", lambda: next(clock))

    notify.notify("Same", "1")
    notify.notify("Same", "2")

    assert len(sent) == 2


@pytest.mark.parametrize("status,error", [
    (500, None),
    (200, urllib.error.URLError("unreachable")),
    (200, ValueError("broken")),
])
def test_a_failed_notification_returns_false(requests, status, error):
    _, outcome = requests
    outcome["status"], outcome["raise"] = status, error

    assert notify.notify("Title", "Body") is False


def test_operator_alert_prefixes_the_title_and_throttles_on_the_bare_title(requests):
    sent, _ = requests

    assert notify.operator_alert("Template missing", submessage="details") is True
    assert notify.operator_alert("Template missing", submessage="again") is False
    assert notify.operator_alert("Something else") is True

    assert [(r["payload"]["title"], r["payload"]["body"], r["payload"]["type"]) for r in sent] == [
        ("Dispatcher: Template missing", "details", "warning"),
        ("Dispatcher: Something else", "Something else", "warning"),
    ]
    assert set(notify._last_notified) == {"Template missing", "Something else"}

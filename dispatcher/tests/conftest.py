import json
import sys
from pathlib import Path

import pytest

SRC_DIR = Path(__file__).resolve().parents[1] / "dispatcher"
sys.path.insert(0, str(SRC_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import main  # noqa: E402
from contract import load_manifest  # noqa: E402


@pytest.fixture(scope="session")
def contract():
    return load_manifest()


class FakeChannel:
    """Records what the dispatcher does with a message."""

    def __init__(self):
        self.acks = []
        self.nacks = []
        self.published = []

    def basic_ack(self, delivery_tag):
        self.acks.append(delivery_tag)

    def basic_nack(self, delivery_tag, requeue=True):
        self.nacks.append((delivery_tag, requeue))

    def basic_publish(self, exchange, routing_key, body, properties=None):
        self.published.append({
            "exchange": exchange,
            "routing_key": routing_key,
            "body": body,
            "headers": dict(properties.headers) if properties and properties.headers else {},
            "delivery_mode": properties.delivery_mode if properties else None,
        })


class FakeSmtp:
    """Records sent mails. Set `fail_with` to make every send raise it, or put an address in
    `fail_for` to make the mail to that address raise its exception."""

    def __init__(self):
        self.sent = []
        self.fail_with = None
        self.fail_for = {}

    def send_message(self, message):
        if self.fail_with is not None:
            raise self.fail_with
        if message["To"] in self.fail_for:
            raise self.fail_for[message["To"]]
        self.sent.append(message)


class Method:
    def __init__(self, delivery_tag=1):
        self.delivery_tag = delivery_tag


class Properties:
    def __init__(self, headers=None):
        self.headers = headers


@pytest.fixture
def fake_channel(monkeypatch):
    channel = FakeChannel()
    # requeue_wait and the dead-letter handler publish through the module's channel.
    monkeypatch.setattr(main, "channel", channel, raising=False)
    return channel


@pytest.fixture
def alerts(monkeypatch):
    """Records operator alerts instead of posting them to Apprise."""
    recorded = []

    def record(message_title, submessage=None):
        recorded.append((message_title, submessage))
        return True

    monkeypatch.setattr(main, "operator_alert", record)
    return recorded


@pytest.fixture
def fake_smtp(monkeypatch):
    smtp = FakeSmtp()
    monkeypatch.setattr(main, "smtpObj", smtp)
    return smtp


@pytest.fixture
def dispatcher(monkeypatch, fake_channel, fake_smtp, alerts):
    """The module set up as main() would, with fakes for RabbitMQ, SMTP and Apprise."""
    monkeypatch.setattr(main, "tpl_environment", main.create_template_environment(), raising=False)
    monkeypatch.setattr(main, "env", "development", raising=False)
    monkeypatch.setattr(main, "EMAIL_ADDRESS", "mailer@example.org")
    return main


def deliver(module, channel, message, headers=None, delivery_tag=1):
    """Hands one message to send_email as RabbitMQ would."""
    body = message if isinstance(message, (bytes, str)) else json.dumps(message)
    module.send_email(channel, Method(delivery_tag), Properties(headers), body)

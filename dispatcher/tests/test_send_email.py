"""send_email: what happens to one message from the email queue."""

import smtplib

import pytest
from conftest import deliver

MESSAGE = {
    "to": "ada@example.org",
    "subject": "Confirm your account",
    "template": "confirm_email.html",
    "parameters": {"name": "Ada", "surname": "Lovelace", "token": "abc123"},
}


@pytest.mark.parametrize("template", ["confirm_email.html", "confirm_email"])
def test_template_names_with_and_without_the_html_suffix_are_rendered(dispatcher, fake_channel, fake_smtp, template):
    deliver(dispatcher, fake_channel, {**MESSAGE, "template": template})

    assert len(fake_smtp.sent) == 1
    assert "Hello Ada Lovelace" in fake_smtp.sent[0].get_content()
    assert fake_channel.acks == [1]
    assert fake_channel.published == []


@pytest.mark.parametrize("body", [b"not json", b"{\"to\": ", b"[]", b"\"text\"", b"42", b"\xff\xfe"])
def test_a_body_that_is_not_a_json_object_is_dropped_with_an_alert(dispatcher, fake_channel, fake_smtp, alerts, body):
    deliver(dispatcher, fake_channel, body)

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert fake_channel.nacks == []
    assert len(alerts) == 1
    assert "not a JSON object" in alerts[0][0]


@pytest.mark.parametrize("template", [42, None, ["confirm_email"]])
def test_a_template_name_that_is_not_a_text_is_dropped_with_an_alert(dispatcher, fake_channel, fake_smtp, alerts, template):
    deliver(dispatcher, fake_channel, {**MESSAGE, "template": template})

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert fake_channel.published == []
    assert len(alerts) == 1


def test_a_lost_smtp_connection_reconnects_and_puts_the_message_back(dispatcher, fake_channel, fake_smtp, monkeypatch):
    reconnects = []
    monkeypatch.setattr(dispatcher, "connect_to_smtp", lambda: reconnects.append(True))
    fake_smtp.fail_with = smtplib.SMTPServerDisconnected("gone")

    deliver(dispatcher, fake_channel, MESSAGE)

    assert reconnects == [True]
    assert fake_channel.acks == []
    assert fake_channel.nacks == [(1, True)]


@pytest.mark.parametrize("error", [
    smtplib.SMTPResponseException(550, b"mailbox unavailable"),
    smtplib.SMTPRecipientsRefused({"ada@example.org": (550, b"no")}),
    ValueError("unexpected"),
])
def test_a_failed_send_goes_to_the_dead_letter_queue(dispatcher, fake_channel, fake_smtp, error):
    fake_smtp.fail_with = error

    deliver(dispatcher, fake_channel, MESSAGE)

    assert fake_channel.acks == []
    assert fake_channel.nacks == [(1, False)]

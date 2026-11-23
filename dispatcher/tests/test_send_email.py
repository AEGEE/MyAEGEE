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


def test_each_recipient_gets_a_mail_of_their_own(dispatcher, fake_channel, fake_smtp):
    deliver(dispatcher, fake_channel, {
        **MESSAGE,
        "to": ["ada@example.org", "grace@example.org"],
        "cc": ["safe.person@example.org"],
        "bcc": "archive@example.org",
        "reply_to": "board@example.org",
    })

    assert [mail["To"] for mail in fake_smtp.sent] == ["ada@example.org", "grace@example.org"]
    for mail in fake_smtp.sent:
        assert mail["Cc"] == "safe.person@example.org"
        assert mail["Bcc"] == "archive@example.org"
        assert mail["Reply-To"] == "board@example.org"
        assert mail["Subject"] == "Confirm your account"
        assert "Hello Ada Lovelace" in mail.get_content()
    assert fake_channel.acks == [1]


def test_a_list_of_parameters_gives_each_recipient_their_own_text(dispatcher, fake_channel, fake_smtp):
    deliver(dispatcher, fake_channel, {
        "to": ["ada@example.org", "grace@example.org"],
        "subject": "Agora",
        "template": "custom.html",
        "parameters": [{"email_body": "<p>Dear Ada</p>"}, {"email_body": "<p>Dear Grace</p>"}],
    })

    assert [(mail["To"], mail.get_content().strip()) for mail in fake_smtp.sent] == [
        ("ada@example.org", "<!-- Just takes one parameter and renders that one unescaped -->\n<p>Dear Ada</p>"),
        ("grace@example.org", "<!-- Just takes one parameter and renders that one unescaped -->\n<p>Dear Grace</p>"),
    ]
    assert fake_channel.acks == [1]


@pytest.mark.parametrize("to,parameters", [
    (["ada@example.org", "grace@example.org"], [{"email_body": "one"}]),
    (["ada@example.org"], [{"email_body": "one"}, {"email_body": "two"}]),
    ("ada@example.org", [{"email_body": "one"}]),
    (["ada@example.org", "grace@example.org"], [{"email_body": "one"}, "two"]),
    (["ada@example.org"], []),
])
def test_a_list_of_parameters_needs_one_object_per_recipient(dispatcher, fake_channel, fake_smtp, alerts, to, parameters):
    deliver(dispatcher, fake_channel, {**MESSAGE, "template": "custom.html", "to": to, "parameters": parameters})

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert len(alerts) == 1


def test_no_mail_is_sent_if_the_text_for_one_recipient_cannot_be_rendered(dispatcher, fake_channel, fake_smtp, alerts):
    deliver(dispatcher, fake_channel, {
        **MESSAGE,
        "template": "custom.html",
        "to": ["ada@example.org", "grace@example.org"],
        "parameters": [{"email_body": "<p>Dear Ada</p>"}, {}],
    })

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert len(alerts) == 1


@pytest.mark.parametrize("to", ["", [], ["ada@example.org", ""], [None], 42])
def test_a_message_without_a_valid_recipient_is_dropped_with_an_alert(dispatcher, fake_channel, fake_smtp, alerts, to):
    deliver(dispatcher, fake_channel, {**MESSAGE, "to": to})

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert len(alerts) == 1


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

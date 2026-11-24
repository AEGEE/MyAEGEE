"""send_email: what happens to one message from the email queue."""

import json
import smtplib

import pytest
from conftest import deliver

MESSAGE = {
    "to": "ada@example.org",
    "subject": "Confirm your account",
    "template": "confirm_email.html",
    "parameters": {"name": "Ada", "surname": "Lovelace", "token": "abc123"},
}


def test_a_valid_message_is_sent_and_acknowledged(dispatcher, fake_channel, fake_smtp, alerts):
    deliver(dispatcher, fake_channel, {**MESSAGE, "from": "board@example.org", "reply_to": "help@example.org"})

    assert len(fake_smtp.sent) == 1
    mail = fake_smtp.sent[0]
    assert mail["From"] == "board@example.org"
    assert mail["To"] == "ada@example.org"
    assert mail["Subject"] == "Confirm your account"
    assert mail["Reply-To"] == "help@example.org"
    assert mail["Cc"] is None and mail["Bcc"] is None
    assert mail.get_content_type() == "text/html"
    assert "https://my.aegee.eu/confirm_signup?token=abc123" in mail.get_content()
    assert fake_channel.acks == [1]
    assert fake_channel.nacks == [] and fake_channel.published == [] and alerts == []


def test_the_sender_defaults_to_the_dispatcher_address(dispatcher, fake_channel, fake_smtp, monkeypatch):
    deliver(dispatcher, fake_channel, MESSAGE)
    assert fake_smtp.sent[0]["From"] == "mailer@example.org"

    monkeypatch.setattr(dispatcher, "EMAIL_ADDRESS", None)
    deliver(dispatcher, fake_channel, {**MESSAGE, "from": None, "cc": "a@example.org, b@example.org", "bcc": ["c@example.org", "d@example.org"]})
    mail = fake_smtp.sent[1]
    assert mail["From"] == ""
    assert mail["Cc"] == "a@example.org, b@example.org"
    assert mail["Bcc"] == "c@example.org, d@example.org"


@pytest.mark.parametrize("field", ["to", "subject", "template", "parameters"])
def test_a_message_without_a_required_field_is_dropped_with_an_alert(dispatcher, fake_channel, fake_smtp, alerts, field):
    message = {key: value for key, value in MESSAGE.items() if key != field}

    deliver(dispatcher, fake_channel, message)

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert fake_channel.published == []
    assert alerts == [(f"Malformed message dropped: missing fields ['{field}']",
                       "The producer sent an incomplete payload. Check the sending service.")]


@pytest.mark.parametrize("parameters", ["text", 42, None])
def test_parameters_that_are_not_an_object_are_dropped_with_an_alert(dispatcher, fake_channel, fake_smtp, alerts, parameters):
    deliver(dispatcher, fake_channel, {**MESSAGE, "parameters": parameters})

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert len(alerts) == 1


def test_a_missing_parameter_drops_the_message_with_an_alert(dispatcher, fake_channel, fake_smtp, alerts):
    deliver(dispatcher, fake_channel, {**MESSAGE, "parameters": {"name": "Ada", "surname": "Lovelace"}})

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert fake_channel.published == []
    assert alerts[0][0] == "Malformed message dropped: undefined template parameter"


def test_an_unknown_template_waits_in_the_first_retry_queue(dispatcher, fake_channel, fake_smtp, alerts):
    deliver(dispatcher, fake_channel, {**MESSAGE, "template": "not_there.html"})

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert len(fake_channel.published) == 1
    published = fake_channel.published[0]
    assert published["exchange"] == ""
    assert published["routing_key"] == "wait_5min"
    assert published["headers"] == {"reason": "template_not_found-not_there.html", "x-retry-index": 0}
    assert published["delivery_mode"] == 2
    assert alerts[0][0] == "A template is missing! (template_not_found-not_there.html)"


def test_a_missing_snippet_waits_in_the_retry_queues(dispatcher, fake_channel, fake_smtp, monkeypatch, tmp_path):
    (tmp_path / "broken.jinja2").write_text('{% include "snippets/missing.jinja2" %}')
    monkeypatch.setattr(dispatcher, "tpl_environment", dispatcher.create_template_environment(str(tmp_path)))

    deliver(dispatcher, fake_channel, {**MESSAGE, "template": "broken"})

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    assert fake_channel.published[0]["routing_key"] == "wait_5min"
    assert fake_channel.published[0]["headers"]["reason"] == "subtemplate_not_found-broken"


def test_without_smtp_the_dispatcher_reconnects_before_sending(dispatcher, fake_channel, fake_smtp, monkeypatch):
    monkeypatch.setattr(dispatcher, "smtpObj", None)
    monkeypatch.setattr(dispatcher, "connect_to_smtp", lambda: setattr(dispatcher, "smtpObj", fake_smtp))

    deliver(dispatcher, fake_channel, MESSAGE)

    assert len(fake_smtp.sent) == 1
    assert fake_channel.acks == [1]


def test_a_message_waits_in_the_retry_queues_while_smtp_is_unavailable(dispatcher, fake_channel, monkeypatch):
    attempts = []
    monkeypatch.setattr(dispatcher, "smtpObj", None)
    monkeypatch.setattr(dispatcher, "connect_to_smtp", lambda: attempts.append(True))

    deliver(dispatcher, fake_channel, MESSAGE, headers={"x-retry-index": 1})

    assert attempts == [True]
    assert fake_channel.acks == [1]
    assert fake_channel.published[0]["routing_key"] == "wait_5h"
    assert fake_channel.published[0]["headers"] == {"reason": "smtp_unavailable", "x-retry-index": 2}


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


THREE = {
    "to": ["ada@example.org", "grace@example.org", "linus@example.org"],
    "subject": "Agora",
    "template": "custom.html",
    "parameters": [{"email_body": "<p>Dear Ada</p>"}, {"email_body": "<p>Dear Grace</p>"}, {"email_body": "<p>Dear Linus</p>"}],
}


def published_message(entry):
    return json.loads(entry["body"])


@pytest.mark.parametrize("error", [
    smtplib.SMTPResponseException(550, b"mailbox unavailable"),
    smtplib.SMTPRecipientsRefused({"ada@example.org": (550, b"no")}),
    ValueError("unexpected"),
])
def test_a_refused_mail_waits_in_the_last_retry_queue(dispatcher, fake_channel, fake_smtp, alerts, error):
    fake_smtp.fail_with = error

    deliver(dispatcher, fake_channel, MESSAGE)

    assert fake_channel.acks == [1]
    assert fake_channel.nacks == []
    [parked] = fake_channel.published
    assert (parked["exchange"], parked["routing_key"]) == ("", "wait_100h")
    assert parked["headers"] == {"reason": "smtp_refused", "x-retry-index": 4}
    assert published_message(parked) == {**MESSAGE, "to": ["ada@example.org"]}
    assert len(alerts) == 1


def test_a_mail_refused_again_after_its_last_retry_is_dropped_with_an_alert(dispatcher, fake_channel, fake_smtp, alerts):
    fake_smtp.fail_with = smtplib.SMTPResponseException(550, b"mailbox unavailable")

    deliver(dispatcher, fake_channel, MESSAGE, headers={"reason": "smtp_refused", "x-retry-index": 4})

    assert fake_channel.acks == [1]
    assert fake_channel.published == []
    assert len(alerts) == 1
    assert "dropped" in alerts[0][0]


def test_a_refused_recipient_does_not_stop_the_others_and_only_they_wait(dispatcher, fake_channel, fake_smtp, alerts):
    fake_smtp.fail_for["grace@example.org"] = smtplib.SMTPRecipientsRefused({"grace@example.org": (550, b"no")})

    deliver(dispatcher, fake_channel, THREE)

    assert [mail["To"] for mail in fake_smtp.sent] == ["ada@example.org", "linus@example.org"]
    assert fake_channel.acks == [1]
    assert fake_channel.nacks == []
    [parked] = fake_channel.published
    assert parked["routing_key"] == "wait_100h"
    assert published_message(parked) == {
        **THREE, "to": ["grace@example.org"], "parameters": [{"email_body": "<p>Dear Grace</p>"}],
    }
    assert len(alerts) == 1


def test_a_lost_connection_after_some_recipients_puts_back_only_the_others(dispatcher, fake_channel, fake_smtp, monkeypatch):
    reconnects = []
    monkeypatch.setattr(dispatcher, "connect_to_smtp", lambda: reconnects.append(True))
    fake_smtp.fail_for["grace@example.org"] = smtplib.SMTPServerDisconnected("gone")
    message = {**MESSAGE, "to": THREE["to"]}

    deliver(dispatcher, fake_channel, message, headers={"x-retry-index": 1})

    assert [mail["To"] for mail in fake_smtp.sent] == ["ada@example.org"]
    assert reconnects == [True]
    assert fake_channel.acks == [1]
    assert fake_channel.nacks == []
    [requeued] = fake_channel.published
    assert (requeued["exchange"], requeued["routing_key"]) == ("eml", "mail")
    assert requeued["headers"] == {"x-retry-index": 1}
    assert requeued["delivery_mode"] == 2
    assert published_message(requeued) == {**message, "to": ["grace@example.org", "linus@example.org"]}


def test_after_a_refusal_and_a_lost_connection_each_part_goes_its_own_way(dispatcher, fake_channel, fake_smtp, monkeypatch, alerts):
    monkeypatch.setattr(dispatcher, "connect_to_smtp", lambda: None)
    fake_smtp.fail_for["ada@example.org"] = smtplib.SMTPRecipientsRefused({"ada@example.org": (550, b"no")})
    fake_smtp.fail_for["grace@example.org"] = smtplib.SMTPServerDisconnected("gone")

    deliver(dispatcher, fake_channel, THREE)

    assert fake_smtp.sent == []
    assert fake_channel.acks == [1]
    parked, requeued = fake_channel.published
    assert parked["routing_key"] == "wait_100h"
    assert published_message(parked)["to"] == ["ada@example.org"]
    assert published_message(parked)["parameters"] == [{"email_body": "<p>Dear Ada</p>"}]
    assert requeued["routing_key"] == "mail"
    assert published_message(requeued)["to"] == ["grace@example.org", "linus@example.org"]
    assert published_message(requeued)["parameters"] == THREE["parameters"][1:]

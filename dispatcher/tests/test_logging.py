"""What the dispatcher logs and alerts about a message: the template name and the names of
fields, never the addresses, parameters or body."""

import logging
import smtplib

import pytest
from conftest import deliver

MARKER = "MARKER-TOKEN-7f3a9c"
ADDRESS = "marker.person@example.org"
MESSAGE = {
    "to": [ADDRESS],
    "subject": f"Subject {MARKER}",
    "template": "confirm_email.html",
    "parameters": {"name": MARKER, "surname": MARKER, "token": MARKER},
}


def without(key):
    return {k: v for k, v in MESSAGE.items() if k != key}


SCENARIOS = {
    "not a JSON object": (f"not json {MARKER} {ADDRESS}".encode(), None),
    "a missing field": (without("subject"), None),
    "parameters that don't match the recipients": ({**MESSAGE, "parameters": [{"name": MARKER}] * 2}, None),
    "a parameter the template needs is missing": ({**MESSAGE, "parameters": {"name": MARKER}}, None),
    "an unknown template": ({**MESSAGE, "template": "no_such_template"}, None),
    "a refused recipient": (MESSAGE, smtplib.SMTPRecipientsRefused({ADDRESS: (550, f"{ADDRESS} {MARKER}".encode())})),
    "a refused mail": (MESSAGE, smtplib.SMTPResponseException(554, f"rejected {ADDRESS} {MARKER}".encode())),
    "an unexpected error": (MESSAGE, ValueError(f"{ADDRESS} {MARKER}")),
    "a lost connection": (MESSAGE, smtplib.SMTPServerDisconnected(f"{ADDRESS} {MARKER}")),
}


@pytest.mark.parametrize("scenario", SCENARIOS)
def test_logs_and_alerts_name_no_address_and_no_parameter_value(dispatcher, fake_channel, fake_smtp, alerts, monkeypatch, caplog, scenario):
    message, error = SCENARIOS[scenario]
    fake_smtp.fail_with = error
    monkeypatch.setattr(dispatcher, "connect_to_smtp", lambda: None)
    caplog.set_level(logging.DEBUG)

    deliver(dispatcher, fake_channel, message)

    assert caplog.records, "the scenario logs something"
    for text in (caplog.text, repr(alerts)):
        assert MARKER not in text
        assert ADDRESS not in text


@pytest.mark.parametrize("scenario", ["a missing field", "a parameter the template needs is missing", "a refused mail"])
def test_logs_name_the_template(dispatcher, fake_channel, fake_smtp, alerts, caplog, scenario):
    message, error = SCENARIOS[scenario]
    fake_smtp.fail_with = error
    caplog.set_level(logging.DEBUG)

    deliver(dispatcher, fake_channel, message)

    assert "confirm_email.html" in caplog.text


def test_a_missing_field_is_named_in_the_log(dispatcher, fake_channel, fake_smtp, alerts, caplog):
    deliver(dispatcher, fake_channel, without("subject"))

    assert "subject" in caplog.text

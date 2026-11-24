"""connect_to_smtp: Mailpit in development, STARTTLS and login in production."""

import smtplib

import main
import pytest


class RecordingSmtp:
    instances = []
    fail_on_connect = None
    fail_on_login = None

    def __init__(self, host, port):
        if RecordingSmtp.fail_on_connect is not None:
            raise RecordingSmtp.fail_on_connect
        self.host, self.port = host, port
        self.calls = []
        RecordingSmtp.instances.append(self)

    def starttls(self):
        self.calls.append("starttls")

    def login(self, user, password):
        if RecordingSmtp.fail_on_login is not None:
            raise RecordingSmtp.fail_on_login
        self.calls.append(("login", user, password))


@pytest.fixture
def smtp_class(monkeypatch):
    RecordingSmtp.instances = []
    RecordingSmtp.fail_on_connect = None
    RecordingSmtp.fail_on_login = None
    monkeypatch.setattr(main.smtplib, "SMTP", RecordingSmtp)
    monkeypatch.setattr(main, "smtpObj", None)
    return RecordingSmtp


def test_development_uses_mailpit_without_tls(smtp_class, monkeypatch):
    monkeypatch.setattr(main, "env", "development", raising=False)

    main.connect_to_smtp()

    [smtp] = smtp_class.instances
    assert (smtp.host, smtp.port) == ("mailpit", 1025)
    assert smtp.calls == []
    assert main.smtpObj is smtp


def test_production_uses_the_configured_server_with_starttls_and_login(smtp_class, monkeypatch):
    monkeypatch.setattr(main, "env", "production", raising=False)
    monkeypatch.setenv("EMAIL_HOST", "smtp.example.org")
    monkeypatch.setenv("EMAIL_PORT", "587")
    monkeypatch.setenv("EMAIL_ADDRESS", "mailer@example.org")
    monkeypatch.setenv("EMAIL_PASSWORD", "secret")

    main.connect_to_smtp()

    [smtp] = smtp_class.instances
    assert (smtp.host, smtp.port) == ("smtp.example.org", "587")
    assert smtp.calls == ["starttls", ("login", "mailer@example.org", "secret")]
    assert main.smtpObj is smtp


@pytest.mark.parametrize("error,logged", [
    (smtplib.SMTPConnectError(421, "busy"), "Could not connect to the SMTP server."),
    (OSError("refused"), "Could not connect to SMTP server for generic reason: refused"),
])
def test_a_failed_connection_is_logged_and_leaves_smtp_unset(smtp_class, monkeypatch, caplog, error, logged):
    monkeypatch.setattr(main, "env", "development", raising=False)
    smtp_class.fail_on_connect = error

    main.connect_to_smtp()

    assert main.smtpObj is None
    assert logged in caplog.text


def test_a_failed_login_is_logged(smtp_class, monkeypatch, caplog):
    monkeypatch.setattr(main, "env", "production", raising=False)
    smtp_class.fail_on_login = smtplib.SMTPAuthenticationError(535, b"no")

    main.connect_to_smtp()

    assert "Failed to authenticate with given credentials." in caplog.text

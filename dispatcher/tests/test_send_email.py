"""send_email: what happens to one message from the email queue."""

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

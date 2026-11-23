"""Escaping and the texts of single templates. Every template is rendered with the
contract's examples in test_contract_templates.py."""

import copy
from pathlib import Path

import pytest
from jinja2 import UndefinedError
from main import create_template_environment

TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"

COMPLETE_PARAMETERS = {
    "application": {
        "answers": ["Answer 1", "Answer 2"],
        "aegee_experience": "AEGEE experience",
        "allergies": "No allergies",
        "body_name": "AEGEE-Delft",
        "created_at": "2026-05-01",
        "date_of_birth": "1995-01-01",
        "email": "member@example.org",
        "first_name": "Ada",
        "gender": "Other",
        "ideal_su": "A great SU",
        "last_name": "Lovelace",
        "meals": "Vegetarian",
        "motivation": "Motivation",
        "nationality": "European",
        "number_of_events_visited": "3",
        "status": "accepted",
        "updated_at": "2026-05-02",
        "visa_city": "Delft",
        "visa_country": "Netherlands",
        "visa_embassy": "Embassy",
        "visa_passport_expiration_date": "2030-01-01",
        "visa_passport_issue_authority": "Authority",
        "visa_passport_issue_date": "2020-01-01",
        "visa_passport_number": "ABC123",
        "visa_place_of_birth": "Delft",
        "visa_postal_code": "1234AB",
        "visa_required": "No",
        "visa_street_and_house": "Main Street 1",
    },
    "board": {
        "elected_date": "2026-04-01",
        "end_date": "2027-04-01",
        "message": "Welcome message",
        "start_date": "2026-05-01",
    },
    "body": "AEGEE-Delft",
    "body_id": 42,
    "body_name": "AEGEE-Delft",
    "changed_by": "Grace Hopper",
    "candidate": {
        "first_name": "Grace",
        "last_name": "Hopper",
    },
    "email_body": "<b>Custom body</b>",
    "event": {
        "location": "Delft",
        "name": "Test Event",
        "questions": [
            {"description": "Question 1?"},
            {"description": "Question 2?"},
        ],
        "status": "submitted",
        "url": "test-event",
    },
    "event_name": "Test Event",
    "last_payment": "2026-04-01",
    "member_email": "member@example.org",
    "member_firstname": "Ada",
    "member_lastname": "Lovelace",
    "member_workspace_email": "ada.lovelace@example.org",
    "membership_fee": "15 EUR",
    "name": "Ada",
    "new_email": "new.address@example.org",
    "old_status": "draft",
    "place": "Delft",
    "position": {
        "event_id": "42",
        "name": "President",
    },
    "positions": [
        {"function": "President", "name": "Ada Lovelace"},
        {"function": "Treasurer", "name": "Grace Hopper"},
    ],
    "requester_body": "AEGEE-Delft",
    "requester_name": "Grace Hopper",
    "surname": "Lovelace",
    "token": "test-token",
    "user_id": 123,
}


def render_template(template_name, parameters=None):
    env = create_template_environment(str(TEMPLATE_DIR))
    template = env.get_template(template_name)
    return template.render(parameters or copy.deepcopy(COMPLETE_PARAMETERS))


def test_default_template_variables_are_escaped():
    parameters = copy.deepcopy(COMPLETE_PARAMETERS)
    parameters["name"] = "<b>Ada</b>"

    rendered = render_template("confirm_email.jinja2", parameters)

    assert "&lt;b&gt;Ada&lt;/b&gt;" in rendered
    assert "Hello <b>Ada</b>" not in rendered


def test_custom_template_keeps_email_body_unescaped():
    rendered = render_template("custom.jinja2", {"email_body": "<b>Custom body</b>"})

    assert "<b>Custom body</b>" in rendered
    assert "&lt;b&gt;Custom body&lt;/b&gt;" not in rendered


def test_missing_template_parameter_fails_fast():
    parameters = copy.deepcopy(COMPLETE_PARAMETERS)
    del parameters["token"]

    with pytest.raises(UndefinedError):
        render_template("confirm_email.jinja2", parameters)


def test_mail_change_old_confirm_shows_requester_new_address_and_token():
    rendered = render_template("mail_change_old_confirm.jinja2")

    assert "<title>MyAEGEE: Confirm the change of your email</title>" in rendered
    assert "Hello Ada Lovelace" in rendered
    assert (
        "Grace Hopper, who manages the members of AEGEE-Delft,"
        " asked to change the login email of your MyAEGEE account"
        " to new.address@example.org. The address only changes if you confirm it:"
    ) in rendered
    assert 'href="https://my.aegee.eu/mail-change?token=test-token"' in rendered
    assert "<i>test-token</i>" in rendered
    assert "The new address has to confirm the change as well." in rendered
    assert "Only confirm if you asked for this and the new address is yours." in rendered
    assert (
        "If you did not expect this mail, do not confirm and contact the Helpdesk:"
        ' <a href="http://aegee.org/helpdesk">'
    ) in rendered
    assert "just ignore this email" not in rendered


def test_mail_change_old_confirm_names_the_requester_without_their_login_email():
    parameters = copy.deepcopy(COMPLETE_PARAMETERS)
    parameters["requester_email"] = "grace.hopper@example.org"

    rendered = render_template("mail_change_old_confirm.jinja2", parameters)

    assert "Grace Hopper, who manages the members of AEGEE-Delft, asked to change" in rendered
    assert "grace.hopper@example.org" not in rendered


def test_mail_change_old_confirm_escapes_values():
    parameters = {
        "name": "<i>Ada</i>",
        "surname": "<u>Lovelace</u>",
        "new_email": "<script>new</script>@example.org",
        "requester_name": "<b>x</b>",
        "requester_body": "<s>AEGEE</s>",
        "token": '"><b>token</b>',
    }

    rendered = render_template("mail_change_old_confirm.jinja2", parameters)

    assert "Hello &lt;i&gt;Ada&lt;/i&gt; &lt;u&gt;Lovelace&lt;/u&gt;" in rendered
    assert "&lt;script&gt;new&lt;/script&gt;@example.org" in rendered
    assert (
        "&lt;b&gt;x&lt;/b&gt;,"
        " who manages the members of &lt;s&gt;AEGEE&lt;/s&gt;, asked to change"
    ) in rendered
    assert 'token=&#34;&gt;&lt;b&gt;token&lt;/b&gt;"' in rendered
    for raw in ("<i>Ada</i>", "<u>Lovelace</u>", "<script>", "<b>x</b>", "<em>mail</em>", "<s>AEGEE</s>", "<b>token</b>"):
        assert raw not in rendered


@pytest.mark.parametrize(
    "missing",
    ["name", "surname", "new_email", "requester_name", "requester_body", "token"],
)
def test_mail_change_old_confirm_needs_every_parameter(missing):
    parameters = copy.deepcopy(COMPLETE_PARAMETERS)
    del parameters[missing]

    with pytest.raises(UndefinedError):
        render_template("mail_change_old_confirm.jinja2", parameters)


@pytest.mark.parametrize("changed_by", ["yourself", "Grace Hopper"])
def test_mail_change_notice_shows_new_address_and_who_asked(changed_by):
    parameters = {
        "name": "Ada",
        "surname": "Lovelace",
        "new_email": "new.address@example.org",
        "changed_by": changed_by,
    }

    rendered = render_template("mail_change_notice.jinja2", parameters)

    assert "<title>MyAEGEE: Your email was changed</title>" in rendered
    assert "Hello Ada Lovelace" in rendered
    assert (
        "The login email of your MyAEGEE account was changed to new.address@example.org."
        f" The change was requested by {changed_by}."
    ) in rendered
    assert "From now on you log in with the new address." in rendered
    assert (
        "If you did not expect this, contact the Helpdesk as soon as possible:"
        ' <a href="http://aegee.org/helpdesk">'
    ) in rendered
    assert "mail-change" not in rendered
    assert "token" not in rendered


def test_mail_change_notice_escapes_values():
    parameters = {
        "name": "<i>Ada</i>",
        "surname": "<u>Lovelace</u>",
        "new_email": "<script>new</script>@example.org",
        "changed_by": "<b>x</b>",
    }

    rendered = render_template("mail_change_notice.jinja2", parameters)

    assert "Hello &lt;i&gt;Ada&lt;/i&gt; &lt;u&gt;Lovelace&lt;/u&gt;" in rendered
    assert "&lt;script&gt;new&lt;/script&gt;@example.org" in rendered
    assert "requested by &lt;b&gt;x&lt;/b&gt;." in rendered
    for raw in ("<i>Ada</i>", "<u>Lovelace</u>", "<script>", "<b>x</b>"):
        assert raw not in rendered


@pytest.mark.parametrize("missing", ["name", "surname", "new_email", "changed_by"])
def test_mail_change_notice_needs_every_parameter(missing):
    parameters = copy.deepcopy(COMPLETE_PARAMETERS)
    del parameters[missing]

    with pytest.raises(UndefinedError):
        render_template("mail_change_notice.jinja2", parameters)

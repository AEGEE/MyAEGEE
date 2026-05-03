import copy
import sys
from pathlib import Path

import pytest
from jinja2 import UndefinedError

SRC_DIR = Path(__file__).resolve().parents[1] / "dispatcher"
sys.path.insert(0, str(SRC_DIR))

from main import create_template_environment  # noqa: E402

TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"
TOP_LEVEL_TEMPLATES = sorted(path.name for path in TEMPLATE_DIR.glob("*.jinja2"))

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
    "surname": "Lovelace",
    "token": "test-token",
    "user_id": 123,
}


def render_template(template_name, parameters=None):
    env = create_template_environment(str(TEMPLATE_DIR))
    template = env.get_template(template_name)
    return template.render(parameters or copy.deepcopy(COMPLETE_PARAMETERS), altro="Test subject")


@pytest.mark.parametrize("template_name", TOP_LEVEL_TEMPLATES)
def test_top_level_templates_render_with_complete_fixture(template_name):
    rendered = render_template(template_name)

    assert rendered.strip()


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

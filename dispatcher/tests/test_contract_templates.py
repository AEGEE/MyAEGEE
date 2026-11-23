"""Every template of the mail contract renders in the dispatcher with its examples, and
reads only parameters the contract declares."""

import copy
import re

import pytest
from contract import declared_paths, load_manifest, required_paths, values_at, variants
from jinja2 import UndefinedError
from main import create_template_environment
from markupsafe import escape
from template_paths import TemplatePaths

MANIFEST = load_manifest()
ENVIRONMENT = create_template_environment()
PATHS = TemplatePaths(ENVIRONMENT)

CASES = [
    pytest.param(name, index, variant, id=f"{name}-{index}-{variant}")
    for name, entry in sorted(MANIFEST["templates"].items())
    for index in range(len(entry["examples"]))
    for variant in ("full", "minimal", "nulls")
]


def render(name, parameters):
    return ENVIRONMENT.get_template(f"{name}.jinja2").render(copy.deepcopy(parameters))


@pytest.mark.parametrize("name,index,variant", CASES)
def test_every_contract_example_renders(name, index, variant):
    entry = MANIFEST["templates"][name]
    parameters = variants(entry["examples"][index], entry["parameters"], MANIFEST)[variant]

    rendered = render(name, parameters)

    assert rendered.strip()
    if name != "custom":  # the sender writes the whole HTML of a custom mail
        title = re.search(r"<title>(.*?)</title>", rendered, re.DOTALL)
        assert title and title.group(1).strip()

    if variant == "full":
        read, _ = PATHS.read(f"{name}.jinja2")
        for path in sorted(read):
            for value in values_at(parameters, path):
                if isinstance(value, str) and value:
                    assert str(escape(value)) in rendered or value in rendered, f"{path} = {value!r} is not in the mail"


@pytest.mark.parametrize("name", sorted(MANIFEST["templates"]))
def test_a_missing_required_parameter_fails_to_render(name):
    # That is how send_email tells a payload it can never render: it drops the message.
    entry = MANIFEST["templates"][name]
    example = entry["examples"][0]["parameters"]
    _, guarded = PATHS.read(f"{name}.jinja2")
    for key in entry["parameters"].get("required", []):
        if key in guarded:
            continue
        parameters = copy.deepcopy(example)
        del parameters[key]
        with pytest.raises(UndefinedError):
            render(name, parameters)


def test_every_template_is_in_the_contract():
    templates = sorted(path.removesuffix(".jinja2") for path in ENVIRONMENT.list_templates() if "/" not in path)
    assert templates == sorted(MANIFEST["templates"])


@pytest.mark.parametrize("name", sorted(MANIFEST["templates"]))
def test_templates_read_only_declared_parameters(name):
    schema = MANIFEST["templates"][name]["parameters"]
    read, _ = PATHS.read(f"{name}.jinja2")

    assert sorted(read - declared_paths(schema, MANIFEST)) == []


@pytest.mark.parametrize("name", sorted(MANIFEST["templates"]))
def test_optional_parameters_are_read_with_a_default(name):
    # Templates render with StrictUndefined: a parameter that senders may leave out must be
    # read through `default` or tested with `is defined`, or the mail is dropped.
    schema = MANIFEST["templates"][name]["parameters"]
    read, guarded = PATHS.read(f"{name}.jinja2")

    unguarded = {path for path in read - required_paths(schema, MANIFEST) if path not in guarded}
    assert sorted(unguarded) == []


def test_the_path_extractor_finds_what_the_templates_read():
    read, guarded = PATHS.read("events_applied.jinja2")
    assert read == {
        "event.name", "event.questions", "event.questions.[].description",
        "application.body_name", "application.created_at", "application.updated_at",
        "application.first_name", "application.last_name", "application.email",
        "application.answers.[]",
    }
    assert guarded == set()

    read, guarded = PATHS.read("network_new_board.jinja2")
    assert {"positions", "positions.[].function", "positions.[].name", "board.message", "body_name"} <= read
    assert guarded == {"board.end_date", "board.message"}

    read, guarded = PATHS.read("mail_change_notice.jinja2")
    assert read == {"name", "surname", "new_email", "changed_by", "changed_by_email"}
    assert guarded == {"changed_by_email"}

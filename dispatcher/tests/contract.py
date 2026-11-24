"""The mail contract (mailer/contract/mail-templates.json) for the dispatcher's tests.

A Python port of what the tests need from mailer/contract/check-mail.cjs: resolving
references, the declared and required parameter paths of a template and the derived
examples (`minimal`: only the required keys; `nulls`: every nullable value set to None).
Paths are dotted; list items are "<path>.[]".
"""

import copy
import json
from pathlib import Path

MANIFEST_PATH = Path(__file__).resolve().parents[2] / "mailer" / "contract" / "mail-templates.json"


def load_manifest():
    return json.loads(MANIFEST_PATH.read_text())


def resolve(schema, manifest):
    while isinstance(schema, dict) and "$ref" in schema:
        schema = manifest["$defs"][schema["$ref"].removeprefix("#/$defs/")]
    return schema


def _join(prefix, key):
    return f"{prefix}.{key}" if prefix else key


def declared_paths(schema, manifest, prefix="", out=None):
    out = set() if out is None else out
    schema = resolve(schema, manifest)
    for key, child in (schema.get("properties") or {}).items():
        at = _join(prefix, key)
        out.add(at)
        declared_paths(child, manifest, at, out)
    if "items" in schema:
        at = _join(prefix, "[]")
        out.add(at)
        declared_paths(schema["items"], manifest, at, out)
    return out


def required_paths(schema, manifest, prefix="", out=None):
    out = set() if out is None else out
    schema = resolve(schema, manifest)
    properties = schema.get("properties") or {}
    for key in schema.get("required") or []:
        at = _join(prefix, key)
        out.add(at)
        if key in properties:
            required_paths(properties[key], manifest, at, out)
    if "items" in schema:
        at = _join(prefix, "[]")
        out.add(at)
        required_paths(schema["items"], manifest, at, out)
    return out


def prune(value, schema, manifest):
    schema = resolve(schema, manifest)
    if isinstance(value, list):
        return [prune(item, schema["items"], manifest) for item in value] if "items" in schema else value
    if isinstance(value, dict):
        properties = schema.get("properties") or {}
        return {
            key: prune(value[key], properties[key], manifest) if key in properties else value[key]
            for key in schema.get("required") or []
            if key in value
        }
    return value


def _allows_null(schema):
    types = schema.get("type")
    return "null" in (types if isinstance(types, list) else [types])


def nulls(value, schema, manifest):
    schema = resolve(schema, manifest)
    if "type" in schema and _allows_null(schema):
        return None
    if isinstance(value, list):
        return [nulls(item, schema["items"], manifest) for item in value] if "items" in schema else value
    if isinstance(value, dict):
        result = copy.deepcopy(value)
        for key, child in (schema.get("properties") or {}).items():
            if key in result:
                result[key] = nulls(result[key], child, manifest)
        return result
    return value


def values_at(value, path):
    """Every value at a dotted path, list items expanded; missing parts are skipped."""
    current = [value]
    for part in path.split("."):
        following = []
        for item in current:
            if part == "[]":
                if isinstance(item, list):
                    following.extend(item)
            elif isinstance(item, dict) and part in item:
                following.append(item[part])
        current = following
    return current


def variants(example, schema, manifest):
    return {
        "full": example["parameters"],
        "minimal": prune(example["parameters"], schema, manifest),
        "nulls": nulls(example["parameters"], schema, manifest),
    }

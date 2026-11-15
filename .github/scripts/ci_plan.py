#!/usr/bin/env python3
"""Decide which CI jobs a change needs, from the files it touches.

Usage: ci_plan.py <base-revision|""> [<head-revision>]

With a base revision, only the services whose directories changed between the
merge base of base and head and head get their jobs. Without one (manual or
scheduled runs, or a push that created the branch), everything runs. A change
to the CI itself or to the root npm workspace files also runs everything.

Writes the job plan as GitHub Actions step outputs (to $GITHUB_OUTPUT, or to
stdout when that isn't set):
  lint, test, build, db  JSON lists used as job matrices ("[]" when empty)
  mailer, dispatcher     "true" or "false"
"""

import json
import os
import subprocess
import sys

# What CI runs for each top-level directory.
#   lint:   "npm" runs `npm run lint`; "frontend" runs eslint over .js and .vue
#   shards: number of parallel test jobs (omitted: the service has no tests)
#   build:  build the service's Docker image with docker compose
#   db:     npm script that recreates the test database from scratch
SERVICES = {
    "core": {"lint": "npm", "shards": 4, "build": True, "db": "db:recreate"},
    "discounts": {"lint": "npm", "shards": 1, "build": True},
    "events": {"lint": "npm", "shards": 1, "build": True, "db": "db:recreate"},
    "frontend": {"lint": "frontend", "build": True},
    "knowledge": {"lint": "npm", "shards": 1, "build": True},
    "network": {"lint": "npm", "shards": 1, "build": True},
    "statutory": {"lint": "npm", "shards": 2, "build": True},
    "summeruniversity": {"lint": "npm", "build": True, "db": "db:setup"},
    "mailer": {"build": True},
    "dispatcher": {},
}

# Paths whose change affects every service.
RUN_ALL_PREFIXES = (".github/workflows/", ".github/scripts/")
RUN_ALL_FILES = ("package.json", "package-lock.json")


def changed_files(base, head):
    """Files changed on head since it diverged from base."""
    out = subprocess.run(
        ["git", "diff", "--name-only", f"{base}...{head}"],
        check=True, capture_output=True, text=True,
    ).stdout
    return [line for line in out.splitlines() if line]


def affected_services(files):
    """Services to run, or all of them if a shared path changed."""
    if any(f.startswith(RUN_ALL_PREFIXES) or f in RUN_ALL_FILES for f in files):
        return set(SERVICES)
    return {f.split("/", 1)[0] for f in files} & set(SERVICES)


def plan(services):
    """Job matrices for the given services, in a stable order."""
    ordered = [s for s in SERVICES if s in services]
    return {
        "lint": [
            {"service": s, "kind": SERVICES[s]["lint"]}
            for s in ordered if "lint" in SERVICES[s]
        ],
        "test": [
            {"service": s, "shard": i, "shards": SERVICES[s]["shards"]}
            for s in ordered if "shards" in SERVICES[s]
            for i in range(1, SERVICES[s]["shards"] + 1)
        ],
        "build": [s for s in ordered if SERVICES[s].get("build")],
        "db": [
            {"service": s, "script": SERVICES[s]["db"]}
            for s in ordered if "db" in SERVICES[s]
        ],
        "mailer": "mailer" in services,
        "dispatcher": "dispatcher" in services,
    }


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else ""
    head = sys.argv[2] if len(sys.argv) > 2 else "HEAD"

    if base and set(base) != {"0"}:
        files = changed_files(base, head)
        services = affected_services(files)
        summary = sorted(services) or "none"
        print(f"{len(files)} changed file(s); services: {summary}", file=sys.stderr)
    else:
        services = set(SERVICES)
        print("No base revision; running everything", file=sys.stderr)

    lines = [
        f"{key}={json.dumps(value) if isinstance(value, list) else str(value).lower()}"
        for key, value in plan(services).items()
    ]
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()

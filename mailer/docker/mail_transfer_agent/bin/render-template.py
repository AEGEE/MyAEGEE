#!/usr/bin/env python3
"""Render a Jinja2 template with the environment variables as context.

Replaces j2cli (unmaintained, and pip installs are blocked on current Alpine).
Usage: render-template.py <template> > <output>
"""
import os
import sys

import jinja2

with open(sys.argv[1], encoding="utf-8") as template_file:
    template = jinja2.Template(
        template_file.read(),
        undefined=jinja2.StrictUndefined,
        keep_trailing_newline=True,
    )

sys.stdout.write(template.render(**os.environ))

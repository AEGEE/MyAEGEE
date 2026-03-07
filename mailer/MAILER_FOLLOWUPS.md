# Mailer Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs


## Fragile Behavior

- nested template access can raise uncaught exceptions when expected maps are missing;
- controller delivery path does not appear to assert on delivery results directly;
- `custom.html.eex` renders raw HTML and should be treated as trusted-input only.

## Improvement Opportunities

- add focused unit tests for `Omsmailer.Page`;
- centralize template input validation before rendering;
- redact or remove raw request logging;

## Future Test Additions

- healthcheck response contract tests;
- `Omsmailer.Page.render_template/2` unit tests;
- recipient/body fan-out edge-case tests;
- fallback JSON error payload assertions.

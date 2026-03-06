# Mailer Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-06

## Bugs

- `mailer/lib/omsmailer_web/plugs/request_logger_plug.ex:18` - request logging includes full POST params, which can leak sensitive recipient and token data.
- `mailer/lib/omsmailer_web/controllers/page_controller.ex:14` - healthcheck reads `package.json` from the filesystem relative to the current working directory.
- `mailer/mix.exs:7` and `mailer/package.json:3` - version metadata is inconsistent.

## Fragile Behavior

- nested template access can raise uncaught exceptions when expected maps are missing;
- controller delivery path does not appear to assert on delivery results directly;
- `custom.html.eex` renders raw HTML and should be treated as trusted-input only.

## Improvement Opportunities

- add focused unit tests for `Omsmailer.Page`;
- centralize template input validation before rendering;
- redact or remove raw request logging;
- move healthcheck metadata to application config rather than filesystem reads.

## Future Test Additions

- healthcheck response contract tests;
- `Omsmailer.Page.render_template/2` unit tests;
- recipient/body fan-out edge-case tests;
- fallback JSON error payload assertions.

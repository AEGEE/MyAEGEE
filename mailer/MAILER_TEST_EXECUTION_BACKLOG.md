# Mailer Test Execution Backlog

**Status:** Draft
**Source plan:** `mailer/MAILER_TEST_COVERAGE_PLAN.md`
**Last updated:** 2026-03-06

## Workstreams

- `Omsmailer.Page` render/fan-out unit tests
- healthcheck response contract coverage
- fallback/error payload assertions
- fragile template input regression tests

## Notes

- prefer focused ExUnit unit tests over controller-only expansion when exercising rendering logic.

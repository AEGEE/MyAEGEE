# Summer University Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs

- `summeruniversity/lib/helpers.js:242` - apply-permission season logic is hardcoded to `2026`.
- `summeruniversity/lib/events.js:173` - default season logic is hardcoded to `2026`.
- `summeruniversity/lib/events.js:272` - edit path also defaults season logic to `2026`.
- `summeruniversity/models/Event.js:523` - `afterSave` mutates `open_call` without clearly persisting it.
- `summeruniversity/lib/imageserv.js:86` - upload replacement can fail after partial success if the previous image file is already missing.

## Fragile Behavior

- package test scripts expect `test/api/*.js`, but there is no `summeruniversity/test` tree today.
- frontend and backend season logic drift will continue every year unless season handling becomes dynamic.
- SU forms and flows mirror events closely, so bugs can spread if logic is copied without shared tests or shared helpers.

## Improvement Opportunities

- Bootstrap a local Jest test harness by porting the `events/test` structure first.
- Replace hardcoded season defaults with dynamic/config-driven season computation.
- Split controller side effects so status rules, application invariants, notifications, and exports are easier to test independently.
- Document intended status and publication rules directly from the code so future rewrites have a stable contract target.

## Future Test Additions

- application creation tests for duplicate applications and season constraints;
- listing tests for publication filters and application status filters;
- model tests for event/application invariants;
- file upload tests for missing-old-file recovery.

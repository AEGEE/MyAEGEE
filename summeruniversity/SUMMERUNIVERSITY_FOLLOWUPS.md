# Summer University Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-06

## Bugs

- `summeruniversity/lib/events.js:264` - edit transition logic uses incoming `data.status` as old status, which likely breaks status transition rules.
- `summeruniversity/lib/events.js:311` - edit flow assumes `data.organizers` is present and may crash on partial updates.
- `summeruniversity/lib/applications.js:53` - application creation likely crashes on missing or unmatched `body_id` because it dereferences `.name` on a failed lookup.
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

- edit tests for partial payloads and correct status transitions;
- application creation tests for invalid `body_id`, duplicates, and season constraints;
- listing tests for publication filters and application status filters;
- model tests for event/application invariants;
- file upload tests for missing-old-file recovery.

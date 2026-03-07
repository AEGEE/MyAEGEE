# Statutory Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs

- `statutory/models/Application.js:507` - `statutory_id` is derived from `COUNT(*) + 1`, which is race-prone under concurrent creates.

## Fragile Behavior

- duplicate route wiring on `MembersListsRouter` in `statutory/lib/server.js` depends heavily on route ordering and is easy to break.
- helper logic matching memberslists by `user_id` only may be stricter than business expectations when imports lack IDs.
- checked-in `junit.xml` and coverage artifacts appear stale and can mislead future work.

## Improvement Opportunities

- add direct unit tests for cron, helpers, and lower-covered models;
- split controller-heavy modules into service and transport layers;
- batch notification-email lookups and other core N+1 fetches;
- refresh README/runtime docs and remove stale generated artifacts from source control.

## Future Test Additions

- concurrent statutory-id uniqueness tests.

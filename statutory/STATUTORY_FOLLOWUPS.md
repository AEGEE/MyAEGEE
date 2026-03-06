# Statutory Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-06

## Bugs

- `statutory/lib/cron.js:96` and `statutory/lib/cron.js:136` - scheduled job handles are not stored, so clear/cancel logic likely does not stop real scheduled work.
- `statutory/models/Plenary.js:17` - `name` is typed as an integer, which looks inconsistent with plenary naming usage.
- `statutory/lib/plenaries.js:215` - helper arguments for body attendance export appear reversed, which likely corrupts exported stats.
- `statutory/lib/middlewares.js:180` and `statutory/lib/middlewares.js:210` - incoming-only application mail enrichment likely loses `notification_email`.
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

- cron clear/edit cancellation tests;
- plenary export correctness tests;
- incoming-only application notification-email visibility tests;
- concurrent statutory-id uniqueness tests.

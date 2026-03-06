# Network Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-06

## Bugs

- `network/lib/boards.js:14` and `network/lib/boards.js:18` - board creation trusts `req.body.body_id` over the route param, which can authorize or create against the wrong body.
- `network/lib/boards.js:158` - board lookup ignores `req.params.body_id`, so the URL is not properly scoped to the body.
- `network/lib/cron.js:8` - scheduled email sends are not awaited, which can hide failures.
- `network/lib/server.js:68` and `network/lib/server.js:82` - current full-suite runs show intermittent `EADDRINUSE` and `app.close()` crashes, which suggests server lifecycle handling is fragile across test files.

## Fragile Behavior

- `network/lib/helpers.js:18` passes sort fields straight through to Sequelize;
- `network/lib/endpoints_metrics.js:20` labels metrics with full `originalUrl`, creating high-cardinality metrics;
- `network/lib/antenna_criteria.js` and `network/lib/mail_component.js` do not clearly validate numeric route params.

## Improvement Opportunities

- derive board `body_id` from the route and reject mismatches explicitly;
- add request validation at route boundaries;
- replace deprecated HTTP libraries;
- add direct helper/middleware tests instead of only API coverage.

## Future Test Additions

- board route/body mismatch tests;
- antenna-criteria permission edge cases;
- metrics content/label assertions.

# Network Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs

- `network/lib/cron.js:8` - scheduled email sends are not awaited, which can hide failures.
- `network/lib/server.js:68` and `network/lib/server.js:82` - current full-suite runs show intermittent `EADDRINUSE` and `app.close()` crashes, which suggests server lifecycle handling is fragile across test files.

## Fragile Behavior

- `network/lib/helpers.js:18` passes sort fields straight through to Sequelize;
- `network/lib/endpoints_metrics.js:20` labels metrics with full `originalUrl`, creating high-cardinality metrics;
- `network/lib/antenna_criteria.js` and `network/lib/mail_component.js` do not clearly validate numeric route params.

## Improvement Opportunities

- add request validation at route boundaries;
- replace deprecated HTTP libraries;
- add direct helper/middleware tests instead of only API coverage.

## Future Test Additions

- antenna-criteria permission edge cases;
- metrics content/label assertions.

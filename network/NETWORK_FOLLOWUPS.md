# Network Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs

- none currently tracked

## Fragile Behavior

- `network/lib/helpers.js:18` passes sort fields straight through to Sequelize;
- `network/lib/antenna_criteria.js` and `network/lib/mail_component.js` do not clearly validate numeric route params.

## Improvement Opportunities

- add request validation at route boundaries;
- replace deprecated HTTP libraries;
- add direct helper/middleware tests instead of only API coverage.

## Future Test Additions

- antenna-criteria permission edge cases.

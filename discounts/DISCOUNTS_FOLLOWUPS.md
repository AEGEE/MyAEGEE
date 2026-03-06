# Discounts Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-06

## Bugs

- `discounts/lib/integrations.js:128` - claim flow is still non-atomic; concurrent requests can race between selecting and updating a free code.
- `discounts/lib/integrations.js:140` - mailer failure leaves the code claimed but returns `500`, which creates a partial-success state for users and admins.
- `discounts/lib/helpers.js:27` - `moment(...).format('YYYY-MM-DD HH:MM')` uses month instead of minutes, so claim emails can show the wrong time.

## Fragile Behavior

- `discounts/lib/helpers.js:37` - permission parsing assumes every permission object has `combined`; malformed upstream payloads currently become a server error instead of a closed denial.
- `discounts/lib/integrations.js:127` - code selection uses plain `findOne`, so claim ordering or fairness is undefined even though the UI implies a simple claim operation.

## Improvement Opportunities

- Introduce transactional claim handling so selection, claim write, and any quota checks occur under a lock.
- Decide whether mailer failure should roll back the claim, enqueue retry, or return a different user-visible state.
- Replace permissive upstream shape assumptions with explicit validation and fail-closed behavior.

## Future Test Additions

- deterministic concurrency coverage around simultaneous claims for the same integration;
- explicit permission-decoder tests for null, duplicate, and partially malformed permission arrays;
- integration-level tests for retry or compensation behavior once mailer partial-failure handling is redesigned.

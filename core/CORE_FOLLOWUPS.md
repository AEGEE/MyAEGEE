# Core Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs


## Fragile Behavior

- `core/middlewares/login.js:110` renew flow has no meaningful refresh-token lifecycle checks;
- `core/middlewares/endpoint-metrics.js:27` uses full `originalUrl` in labels, increasing metric cardinality;
- several create/update handlers still accept broad request bodies without strict field whitelisting.

## Improvement Opportunities

- add direct tests for permission graph logic in `core/lib/permissions-manager.js`;
- harden token lifecycle and rotation semantics;
- tighten create/update field whitelists;
- replace deprecated HTTP client usage and reduce request-time graph recomputation.

## Future Test Additions

- refresh-token lifecycle tests;
- metrics contract tests.

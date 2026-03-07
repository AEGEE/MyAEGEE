# Core Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs


## Fragile Behavior

- `core/middlewares/login.js:110` renew flow has no meaningful refresh-token lifecycle checks;
- several create/update handlers still accept broad request bodies without strict field whitelisting.

## Improvement Opportunities

- harden token lifecycle and rotation semantics;
- tighten create/update field whitelists;
- replace deprecated HTTP client usage and reduce request-time graph recomputation.

## Future Test Additions

- refresh-token lifecycle tests;

# Core Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs


## Fragile Behavior

- several create/update handlers still accept broad request bodies without strict field whitelisting.

## Improvement Opportunities

- add refresh-token expiry or session-management limits on top of the new rotation semantics;
- tighten create/update field whitelists;
- replace deprecated HTTP client usage and reduce request-time graph recomputation.

## Future Test Additions

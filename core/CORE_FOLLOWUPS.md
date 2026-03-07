# Core Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs


## Fragile Behavior

- some create/update handlers still accept broader request bodies than necessary, especially outside the newly tightened permission/body/campaign/circle paths.

## Improvement Opportunities

- add refresh-token expiry or session-management limits on top of the new rotation semantics;
- tighten create/update field whitelists;
- replace deprecated HTTP client usage and reduce request-time graph recomputation.

## Future Test Additions

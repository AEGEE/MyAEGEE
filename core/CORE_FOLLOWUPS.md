# Core Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-06

## Bugs

- `core/middlewares/body-campaigns.js:44` - campaign creation uses `req.currentBody.idd` instead of the field used elsewhere for body linkage.
- `core/lib/cron.js:102` - clearing jobs removes bookkeeping without clearly cancelling the underlying scheduled task.
- `core/lib/imageserv.js:71` - malformed uploads can leave temp files behind.
- `core/lib/imageserv.js:81` and `core/lib/imageserv.js:96` - unlink paths appear unguarded for missing files.

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

- body-campaign linkage regression tests;
- refresh-token lifecycle tests;
- upload cleanup and missing-old-file tests;
- cron clearAll stop-behavior tests;
- metrics contract tests.

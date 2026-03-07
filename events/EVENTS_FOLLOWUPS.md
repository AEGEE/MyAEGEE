# Events Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs

- `events/lib/imageserv.js:44` - upload replacement can fail after partial success if the previous image file is already missing.
- `events/lib/server.js:92` and `events/lib/server.js:105` - current full-suite runs show intermittent `EADDRINUSE` and null-close failures, which suggests server lifecycle handling is fragile across test files.

## Fragile Behavior

- `events/lib/applications.js` - export path performs repeated core login/member fetches, creating an N+1 remote dependency pattern.
- `events/lib/server.js` - nominally public routes still depend on auth middleware reaching core successfully enough to tolerate unauthorized access.
- `events/package.json:5` - `main` points to `server.js`, but runtime entrypoints live under `lib/`, which is packaging/documentation drift.

## Improvement Opportunities

- Add explicit contract tests for public response fields consumed by the frontend.
- Batch or cache export-time core lookups to reduce latency and failure amplification.
- Replace deprecated `request`-based integrations with a maintained HTTP client and explicit decoding.
- Remove or repair stale frontend routes that call nonexistent backend endpoints such as legacy participants/service-admin paths.

## Future Test Additions

- upload replacement tests for missing old image files;
- metrics contract tests for metric names and labels;
- helper/model suites for permission derivation, flattening, field export names, and event/application validation.

# PR #1924 Review Notes

Branch: `docs/discounts-test-coverage-plan`
Base: `stable`
PR: `#1924` - `fix(monorepo): complete follow-up regressions and coverage backlog`
Status: Blocked

## Overall verdict

- Overall status: `BLOCKED`
- Main blocker: `core` now rotates refresh tokens, but `frontend` still persists only the renewed access token, so the next renew or logout can use a stale refresh token and fail.

## Highest-impact findings

### Blockers

1. Refresh-token rotation is not reflected in the frontend renew flow.
   - `frontend/src/http-interceptors.js:31`
   - `core/middlewares/login.js:154`
   - `core/test/api/renew.test.js:47`
   - `frontend/tests/unit/http-interceptors.spec.js:54`

### Warnings

1. Metrics normalization is only partial in `core` and `network`.
   - `core/middlewares/endpoint-metrics.js:35`
   - `core/middlewares/endpoint-metrics.js:43`
   - `network/lib/endpoints_metrics.js:37`

2. `core` server lifecycle can duplicate cron registrations on restart.
   - `core/lib/server.js:234`
   - `core/lib/server.js:278`
   - `core/lib/cron.js:96`

3. Several draft PR claims are stronger than the validation that is actually listed.
   - New lifecycle, metrics, and image-upload regression tests were added but omitted from the validation section for multiple packages.

4. Cross-package fixtures and contract assumptions are still drifting.
   - `discounts/test/assets/core-auth-unauthorized.json:1`
   - `discounts/test/assets/mailer-unsuccessful.json:1`

## Per-package findings

### core

- Verdict: `REQUEST CHANGES`
- Metrics fix is incomplete because the `endpoint` label still uses raw URLs.
- Restart handling can duplicate cron jobs because stop does not clear them.
- Refs:
  - `core/middlewares/endpoint-metrics.js:43`
  - `core/lib/server.js:278`

### frontend

- Verdict: `BLOCKED`
- Rotated refresh tokens are not persisted after `/renew`.
- Route and loading-state regressions are otherwise covered well.
- Refs:
  - `frontend/src/http-interceptors.js:31`
  - `frontend/tests/unit/regressions/ApplyRoutes.spec.js:34`

### discounts

- Verdict: `REQUEST CHANGES`
- Claim flow still consumes code/quota before mail send succeeds.
- Tests currently lock in that partial-failure behavior.
- Refs:
  - `discounts/lib/integrations.js:140`
  - `discounts/test/api/codes-claiming.test.js:156`

### events

- Verdict: `REQUEST CHANGES`
- Applicant identity preservation is incomplete because privileged edits can still rewrite body affiliation.
- Refs:
  - `events/lib/applications.js:92`
  - `events/lib/helpers.js:237`

### summeruniversity

- Verdict: `REQUEST CHANGES`
- Open-call auto-close still misses oversubscribed events.
- Season/default behavior still drifts in package fixtures.
- Refs:
  - `summeruniversity/lib/events.js:475`
  - `summeruniversity/test/scripts/generator.js:10`

### statutory

- Verdict: `REQUEST CHANGES`
- New lifecycle test mutates shared config and can make the suite order-dependent.
- Refs:
  - `statutory/test/unit/server-lifecycle.test.js:1`

### network

- Verdict: `REQUEST CHANGES`
- Metrics label normalization is still incomplete.
- `DELETE /netcom/:body_id` still skips proper param validation.
- Refs:
  - `network/lib/endpoints_metrics.js:37`
  - `network/lib/netcom.js:35`

### mailer

- Verdict: `REQUEST CHANGES`
- `/healthcheck` version metadata can drift from Docker/build metadata.
- Request-logging tests do not prove actual Phoenix pipeline behavior.
- Refs:
  - `mailer/lib/omsmailer_web/controllers/page_controller.ex:14`
  - `mailer/docker/mailer/Dockerfile:19`

## Cross-package findings

### Core reflected in others

1. `frontend` does not reflect core refresh-token rotation.
   - `core/middlewares/login.js:128`
   - `frontend/src/http-interceptors.js:31`

2. Metrics conventions diverge across services.
   - `core/middlewares/endpoint-metrics.js:38`
   - `discounts/lib/endpoints_metrics.js:15`
   - `events/lib/endpoints_metrics.js:15`
   - `summeruniversity/lib/endpoints_metrics.js:15`
   - `statutory/lib/endpoints_metrics.js:15`
   - `network/lib/endpoints_metrics.js:19`

3. Server lifecycle improvements are only partially reflected across sibling services.
   - `core/lib/server.js:210`
   - `network/lib/server.js:70`
   - `statutory/lib/server.js:202`
   - `events/lib/server.js:91`
   - `discounts/lib/server.js:60`
   - `summeruniversity/lib/server.js:94`

4. Permission payload hardening is uneven across downstream consumers.
   - `discounts/lib/helpers.js:36`
   - `events/lib/helpers.js:140`
   - `summeruniversity/lib/helpers.js:159`
   - `statutory/lib/helpers.js:267`
   - `network/lib/helpers.js:34`

### Others reflected into core

1. Core should own stronger contract coverage for refresh-token handoff and shared profile shapes.
   - `core/test/api/renew.test.js:35`
   - `discounts/test/assets/core-profile-success.json:1`

2. Core should own clearer metrics behavior and shared mocks for downstream services.
   - `core/test/unit/endpoint-metrics.test.js:1`
   - `core/test/scripts/mock.js:1`

### Others reflected into frontend

1. Auth token rotation is not fully reflected in frontend runtime behavior.
   - `frontend/src/http-interceptors.js:31`
   - `frontend/tests/unit/http-interceptors.spec.js:54`

2. Summer University season handling is only partially reflected in frontend.
   - `summeruniversity/lib/events.js:197`
   - `frontend/src/views/summeruniversity/List.vue:170`
   - `frontend/src/views/summeruniversity/Edit.vue:86`
   - `frontend/src/views/summeruniversity/EditSecond.vue:62`

## Suggested fix order

1. Fix refresh-token rotation handling between `core` and `frontend`.
2. Finish metrics normalization consistently across services.
3. Fix `core` restart and cron cleanup behavior.
4. Tighten PR summary and validation so it matches the actual code and executed suites.

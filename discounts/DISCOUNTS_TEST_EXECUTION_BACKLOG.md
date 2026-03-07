# Discounts Test Execution Backlog

**Status:** Implemented
**Source plan:** `discounts/DISCOUNTS_TEST_COVERAGE_PLAN.md`
**Last updated:** 2026-03-06

## 1. Purpose

This backlog turns the discounts test coverage plan into parallel workstreams that can be executed by subagents or contributors with minimal rediscovery.

The goal is to strengthen tests around contracts and observable behavior so the discounts backend can later be replaced with minimal test churn.

Execution status:

- Foundation A completed
- Foundation B completed
- Stream 1 completed
- Stream 2 completed
- Stream 3 completed
- Stream 4 completed
- Stream 5 completed
- Stream 6 completed

## 2. Notes

This backlog is now largely archival: the foundations and named streams below have matching backend and frontend coverage in place.

## 3. Parallel Workstreams

## Stream 1: Claim Flow Regression (completed)

### Scope

- `discounts/lib/integrations.js`
- related backend tests in `discounts/test/api`

### Goal

Lock down the highest-risk user workflow: claiming a discount code.

### Tests To Add

- quota boundary within the configured period;
- quota exceeded response;
- no unclaimed code available;
- repeated claim attempts by the same user;
- mailer failure after claim update;
- concurrent claims targeting the same integration.

### Fixtures Required

- at least one integration with limited quota;
- multiple available codes for the same integration;
- a mailer failure fixture.

### Notes

- focus on observable behavior first;
- if concurrency is hard to assert deterministically, document the smallest reproducible regression test possible.

### Validation

- `npm test` in `discounts`

## Stream 2: Permission And Adapter Contracts (completed)

### Scope

- `discounts/lib/helpers.js`
- `discounts/lib/core.js`
- `discounts/lib/mailer.js`
- backend tests touching permission decoding and external calls

### Goal

Ensure the package behaves consistently across realistic `core` and `mailer` responses.

### Tests To Add

- `manage:discounts` detection from realistic permission arrays;
- unrelated permission arrays;
- malformed permission entries;
- empty permission lists;
- unsuccessful `core` response envelopes;
- unauthorized and network failures;
- outbound mail request shape assertions if feasible.

### Fixtures Required

- named `core` permission fixtures;
- named `mailer` success and failure fixtures.

### Validation

- `npm test` in `discounts`

## Stream 3: Helper And Model Validation (completed)

### Scope

- `discounts/lib/helpers.js`
- `discounts/models/Category.js`
- any related test helpers or factories

### Goal

Pull behavior out of broad API tests and make validation expectations explicit.

### Tests To Add

- `isNumber` edge cases;
- `getMailText` invariants that matter to consumers;
- category discount-array validation behavior;
- malformed nested discount objects;
- any model validation currently covered only indirectly.

### Fixtures Required

- valid and invalid category payloads;
- representative code, integration, and user inputs for mail text generation.

### Validation

- `npm test` in `discounts`

## Stream 4: Metrics And Error Paths (completed)

### Scope

- metrics endpoints and related backend tests;
- error middleware coverage where currently thin

### Goal

Cover operational contracts and failure semantics, not just success status codes.

### Tests To Add

- expected metric names in `/metrics` output;
- expected request metric labels where practical;
- backend dependency failures producing correct response semantics;
- hidden or skipped error branches that are important to preserve.

### Fixtures Required

- realistic request traffic setup;
- dependency failure fixtures.

### Validation

- `npm test` in `discounts`

## Stream 5: Frontend Catalog And Claim Flows (completed)

### Scope

- `frontend/src/views/discounts/DiscountsList.vue`
- `frontend/src/views/discounts/MyDiscounts.vue`

### Goal

Protect the highest-value frontend behaviors that depend on discounts and core contracts.

### Tests To Add

- categories load succeeds and permissions load succeeds;
- categories load succeeds and permissions load fails;
- management buttons appear only when permission fixtures allow them;
- claimed codes load succeeds and integrations load succeeds;
- claimed codes load succeeds and integrations load fails;
- claim success with local integration backfill;
- claim failure path;
- empty-state behavior.

### Fixtures Required

- categories success envelope;
- permissions success and failure envelopes;
- claimed codes envelope;
- integrations envelope;
- claim response with minimal backend payload.

### Validation

- frontend test command for discounts views

## Stream 6: Frontend Management Flows (completed)

### Scope

- `frontend/src/views/discounts/CategoriesList.vue`
- `frontend/src/views/discounts/CategoryEdit.vue`
- `frontend/src/views/discounts/List.vue`
- `frontend/src/views/discounts/Edit.vue`
- `frontend/src/views/discounts/AddCodes.vue`

### Goal

Protect management screens that depend on backend authorization and validation behavior.

### Tests To Add

- list fetch and render behavior;
- create and update form success paths;
- structured validation error rendering;
- delete failures and permission failures;
- direct-route management access when backend denies permission;
- add-codes success and failure flows.

### Fixtures Required

- category and integration form payloads;
- validation error envelopes;
- forbidden and not-found envelopes.

### Validation

- frontend test command for discounts management views

## 4. Recommended Execution Order

1. Foundation A: fixture inventory cleanup
2. Stream 1: claim flow regression
3. Stream 2: permission and adapter contracts
4. Foundation B: frontend test harness
5. Stream 5: frontend catalog and claim flows
6. Stream 6: frontend management flows
7. Stream 3: helper and model validation
8. Stream 4: metrics and error paths

This order prioritizes business-critical backend behavior first, then consumer-facing frontend coverage, then lower-level and operational coverage.

## 5. Handoff Format For Subagents

Each subagent should return updates in this exact shape:

- `scope`: what stream or sub-scope was handled
- `files changed`: exact paths
- `tests added`: concise list of scenarios
- `fixtures added or updated`: exact fixture names or files
- `validation run`: commands executed and result
- `follow-up gaps`: anything still uncovered or blocked

## 6. Suggested Commit Strategy

Keep commits small enough that later agents can reconstruct progress quickly.

Recommended commit sequence:

1. fixture groundwork
2. claim-flow regression tests
3. permission and adapter tests
4. frontend harness
5. frontend catalog and claim tests
6. frontend management tests
7. helper, model, metrics, and cleanup work

## 7. Issue Tracker Mapping

If these streams are turned into `bd` issues, create one issue per foundation or stream and link them back to the source plan.

Suggested issue titles:

- `discounts: normalize core and mailer test fixtures`
- `discounts: add claim flow regression coverage`
- `discounts: add permission and adapter contract tests`
- `frontend: add discounts component test harness`
- `frontend: test discounts catalog and claim flows`
- `frontend: test discounts management flows`
- `discounts: add helper model and metrics coverage`

## 8. Implementation Notes And Reusable Findings

These notes came out of the first implementation passes and should help when repeating the workflow in other packages.

- Normalize external fixtures behind a package-local registry instead of scattering file names across tests.
- Keep legacy mock options working while adding named fixtures so tests can migrate incrementally.
- Prefer realistic "unrelated permissions" fixtures over only empty-permission fixtures, because they better match real authorization drift.
- When testing quota or time-window logic, use direct timestamp control at the database level when ORM timestamp helpers are unreliable.
- Verify post-side-effect state explicitly: for example, mailer failure tests should also assert whether the database mutation already happened.
- For local package work, a standalone Docker Postgres with env overrides is enough; full Traefik wiring is not required for backend test coverage.
- Add direct adapter tests for outbound headers and payloads so contract coverage does not depend only on higher-level API tests.
- For frontend consumer coverage, start with a thin Vue test harness that mocks `axios` and Vuex getters before trying to mount the full application shell.
- If Buefy table slots make component tests noisy, stub table primitives and assert component state plus side effects instead of full table rendering.
- Add a small helper-and-model suite even when API coverage is strong, so validation and formatting behavior stay visible during backend replacement.

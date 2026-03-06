# Discounts Test Coverage Plan

**Status:** Draft
**Owner:** `discounts` contributors
**Last updated:** 2026-03-06

## Progress Snapshot

Implemented on branch `docs/discounts-test-coverage-plan` so far:

- normalized external `core` and `mailer` fixtures for backend tests;
- stronger claim-flow regression coverage around quotas and post-claim mailer failures;
- direct adapter and permission contract tests;
- stronger metrics assertions for named metrics and endpoint labels;
- direct helper and model validation tests;
- frontend Vue unit-test harness for discounts views;
- frontend component coverage for catalog, claim, and key management flows.

## 1. Objective

Improve `discounts` test coverage so the package can keep the same behavior and contracts even if the backend implementation changes later.

This plan focuses on:

- backend behavior and contracts in the `discounts` package;
- frontend expectations for discounts-related flows;
- realistic fixtures for `core`, `mailer`, and discounts API responses;
- reducing test coupling to the current implementation.

This plan does not choose a future migration strategy. The immediate goal is stable, portable tests.

## 2. Current State

### Package Shape

- Runtime: CommonJS JavaScript on Node.js.
- HTTP layer: Express handlers in `discounts/lib`.
- Persistence: Sequelize models in `discounts/models`.
- Main external dependencies:
  - `core` for authenticated user and permissions;
  - `mailer` for sending claimed-code emails.

### Current Test Shape

- Main test command: `discounts/package.json:14`
- Existing suites are mostly API-style tests under `discounts/test/api`.
- Current tests exercise real handler flows with DB setup and mocked external HTTP dependencies.
- There are no dedicated unit-test suites for helpers, adapters, or models in isolation.

### Current Mock Shape

- `discounts/test/scripts/mock.js` stubs:
  - `core /members/me`
  - `core /my_permissions`
  - `mailer /`
- Current permission fixtures are useful but shallow:
  - full permissions
  - empty permissions
  - unauthorized
  - generic bad response or network error

## 3. Consumer Map

### Frontend Consumers

The frontend directly consumes discounts endpoints from view components rather than through a dedicated service wrapper.

Key consumers:

- `frontend/src/views/discounts/DiscountsList.vue`
- `frontend/src/views/discounts/MyDiscounts.vue`
- `frontend/src/views/discounts/CategoriesList.vue`
- `frontend/src/views/discounts/CategoryEdit.vue`
- `frontend/src/views/discounts/List.vue`
- `frontend/src/views/discounts/Edit.vue`
- `frontend/src/views/discounts/AddCodes.vue`

### Important Frontend Assumptions

- `DiscountsList` loads categories from `discounts`, then permissions from `core`.
- `MyDiscounts` loads claimed codes, then available integrations.
- `MyDiscounts` patches claim responses locally by attaching integration details from the currently loaded integrations list.
- management buttons are hidden based on `permission.combined.endsWith('manage:discounts')`.
- route access is less protected than the UI; some views rely on backend enforcement instead of frontend route guards.

### Practical Implication

The discounts test plan must cover both the package contracts and the consumer assumptions layered on top of them.

## 4. Existing Test Coverage

### Areas With Coverage

- API auth and general request handling.
- integrations CRUD flows.
- categories CRUD flows.
- claiming and displaying codes.
- metrics smoke coverage.

### Areas With Weak Coverage

- direct helper behavior in `discounts/lib/helpers.js`.
- exact `core` and `mailer` adapter contracts.
- malformed permission payloads from `core`.
- metrics content and labels.
- category validation and model edge cases.
- race conditions and partial failures during code claiming.

### Frontend Coverage State

- no dedicated frontend test harness currently exists in `frontend/package.json`.
- discounts UI flows therefore have no component-level regression coverage.

## 5. Mocking And Fixture Gaps

The current backend mocks are enough for basic endpoint testing, but not enough for stable cross-package contract coverage.

### Core Gaps

Add reusable fixtures for:

- valid user + valid permissions;
- valid user + unrelated permissions only;
- valid user + malformed permission objects;
- valid user + empty `data` array;
- `success: false` response body;
- unauthorized response;
- network failure;
- unexpected envelope shape.

### Discounts API Gaps For Frontend Tests

Add reusable fixtures for:

- categories with multiple discounts;
- empty category lists;
- integrations with different quota states;
- claimed codes with nested integration data;
- claim response without nested integration data;
- validation errors for create or update forms;
- not found responses for deleted or missing resources;
- mixed-success multi-request sequences.

### Mailer Gaps

Add fixtures or assertions for:

- expected request payload shape;
- expected subject and template;
- successful send;
- `success: false` body;
- transport failure after code claim.

## 6. Review Batch Plan

The review batch should produce execution-ready findings without changing production behavior.

### Review Agent A: Discounts Package Architecture

Scope:

- `discounts/lib`
- `discounts/models`
- route and middleware wiring

Deliverables:

- endpoint map;
- model and association map;
- side-effect map for `core`, `mailer`, metrics, and database writes;
- ranked list of behavior that should remain stable across backend changes.

### Review Agent B: Existing Tests And Fixtures

Scope:

- `discounts/test`
- `discounts/test/scripts`
- `discounts/test/assets`

Deliverables:

- suite inventory;
- fixture inventory;
- weak-coverage areas;
- recommendations for fixture reuse and normalization.

### Review Agent C: Frontend Usage

Scope:

- `frontend/src/views/discounts`
- routes, menu, auth, and service access

Deliverables:

- file inventory by flow;
- actual payload shapes used by the UI;
- multi-request flow map;
- locations where the UI backfills or normalizes data locally;
- recommended component tests.

### Review Agent D: High-Risk Behavior

Focus on:

- concurrency;
- authorization;
- validation;
- partial failures;
- metrics;
- implicit assumptions hidden by current mocks.

Deliverables:

- ranked risk list with `why it matters`;
- recommended test type for each risk;
- a split into parallel implementation tasks.

## 7. Execution Batch Plan

The second batch should implement tests in parallel across low-overlap workstreams.

### Stream 1: Claim Flow Regression Tests

Target areas:

- `discounts/lib/integrations.js` claim flow

Tests to add:

- quota boundary behavior by period;
- claim when no codes remain;
- repeat claims by the same user;
- behavior when the mailer fails after the DB update;
- concurrency and double-claim prevention.

Reason:

This is the highest-value workflow and the most likely source of expensive regressions.

### Stream 2: Adapter And Permission Contract Tests

Target areas:

- `discounts/lib/core.js`
- `discounts/lib/mailer.js`
- `discounts/lib/helpers.js`

Tests to add:

- exact permission decoding behavior;
- malformed permission payload handling;
- exact outbound request shapes where feasible;
- mapping of upstream failures to package behavior.

Reason:

The current suite covers these paths indirectly but does not lock down the contracts strongly enough.

### Stream 3: Helper And Model Validation Tests

Target areas:

- helper functions;
- category validation;
- model-level edge cases.

Tests to add:

- `isNumber` edge cases;
- `getMailText` formatting invariants;
- category `discounts` validation and malformed payloads;
- uniqueness or validation edges that are currently only discovered through endpoint tests.

Reason:

These tests reduce the amount of behavior hidden inside larger API suites.

### Stream 4: Metrics And Error-Path Tests

Target areas:

- metrics endpoints;
- error middleware branches;
- dependency-failure paths.

Tests to add:

- response body assertions for expected metric names and labels;
- failure-path assertions beyond status code only;
- error propagation and fallback behavior.

Reason:

Metrics and error behavior are part of operational contracts and should survive implementation swaps.

### Stream 5: Frontend Test Harness

Target areas:

- frontend package test tooling and base setup

Tasks:

- introduce a frontend component test runner;
- add shared mocking utilities for `axios` or HTTP-level request interception;
- add shared discounts and core fixtures.

Reason:

Consumer behavior is currently unprotected by tests, so backend changes can break the UI silently.

### Stream 6: Frontend Discounts Flow Tests

Target views:

- `DiscountsList`
- `MyDiscounts`
- `Edit`
- `CategoryEdit`
- `List`
- `CategoriesList`
- `AddCodes`

Tests to add:

- happy path render and submit flows;
- mixed-success multi-request flows;
- permission-driven UI changes;
- form validation failures;
- direct-route behavior when backend denies access;
- local claim-response normalization in `MyDiscounts`.

Reason:

These tests preserve the real behavior expected by the frontend even if the discounts backend is replaced.

## 8. Prioritized Backlog

### Priority 1

- claim-flow regression tests;
- permission and adapter contract tests;
- fixture expansion for `core` and `mailer`.

### Priority 2

- frontend harness setup;
- `DiscountsList` and `MyDiscounts` component tests;
- category and integration form error-path tests.

### Priority 3

- helper and model direct tests;
- metrics content assertions;
- route-access and UI permission tests for management screens.

### Priority 4

- lower-level cleanup and fixture deduplication;
- any deferred edge cases discovered during implementation.

## 9. Concrete Suggestions For More Exhaustive Mocks

### Core Permission Fixtures

Add named fixtures for:

- `core-permissions-discounts-manager`
- `core-permissions-unrelated-only`
- `core-permissions-empty`
- `core-permissions-malformed-entry`
- `core-permissions-unsuccessful-envelope`
- `core-permissions-unauthorized`

These fixtures should be reusable in both backend and frontend test suites.

### Multi-Request Frontend Scenarios

Add test scenarios where:

1. categories load succeeds and permissions load fails;
2. claimed codes load succeeds and integrations load fails;
3. integrations load succeeds but claim fails;
4. claim succeeds with a minimal backend payload and the UI patches integration info locally;
5. create or update requests return structured validation errors.

### Contract Envelope Rules

When mocking `core` or `discounts` responses, prefer full envelopes:

- `{ success: true, data: ... }`
- `{ success: false, message: ... }`
- HTTP-level failures with realistic status codes

Avoid raw arrays unless the real API truly returns a raw array.

## 10. Completion Criteria

This effort is complete when:

- the highest-priority backend claim and permission paths have dedicated regression coverage;
- frontend discounts flows have component-level coverage for happy and failure paths;
- reusable fixtures exist for realistic `core`, `mailer`, and discounts API contracts;
- tests assert contract behavior rather than current implementation structure;
- the package can be reimplemented behind the same observable behavior with minimal test changes.

## 11. Reuse Notes For Other Packages

When repeating this process for another package:

- start from `docs/TEST_COVERAGE_WORKFLOW.md`;
- create a package-local plan using the same section layout as this file;
- replace the consumer map, dependency map, and prioritized backlog with package-specific details;
- keep the focus on stable contracts, realistic fixtures, and consumer-facing behavior.

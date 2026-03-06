# Events Test Coverage Plan

**Status:** In progress
**Owner:** `events` contributors
**Last updated:** 2026-03-06

## 1. Objective

Improve `events` test coverage so the package can preserve stable backend and frontend-facing behavior even if internals are reorganized later.

This plan focuses on:

- backend API and contract behavior in the `events` package;
- frontend expectations for public, organizer, and approver event flows;
- stronger fixtures for `core`, `mailer`, image upload, and event export contracts;
- reducing test coupling to current implementation details.

## 2. Current State

### Package Shape

- Runtime: CommonJS Node.js service with Express routes under `events/lib/server.js`.
- Main business logic:
  - `events/lib/events.js`
  - `events/lib/applications.js`
- Persistence: Sequelize models in `events/models` for `Event` and `Application`.
- Main external dependencies:
  - `core`
  - `mailer`
  - `imageserv`

### Current Test Shape

- Existing coverage is mostly API-style Jest suites under `events/test/api`.
- Current tests cover many major endpoints and permission branches.
- There is little direct helper/model coverage and only shallow metrics assertions.

### Current Risks

- public response-field drift versus frontend expectations;
- brittle application create paths around `body_id` and core lookups;
- upload replacement partial failures;
- export-time core N+1 behavior;
- stale or undocumented backend/frontend contract mismatches.

## Progress Snapshot

Implemented on branch `docs/discounts-test-coverage-plan` so far:

- added `events/EVENTS_FOLLOWUPS.md`;
- added package planning docs for events;
- strengthened metrics assertions in `events/test/api/metrics.test.js`;
- added direct helper/model contract tests in `events/test/api/helpers-models.test.js`.

## 3. Consumer Map

### Frontend Consumers

Key consumers include:

- `frontend/src/views/events/List.vue`
- `frontend/src/views/events/Single.vue`
- `frontend/src/views/events/Apply.vue`
- `frontend/src/views/events/Edit.vue`
- `frontend/src/views/events/Participants.vue`
- `frontend/src/views/events/BoardView.vue`
- `frontend/src/views/events/ChangeStatus.vue`
- dashboard and network views that reuse event list/recents endpoints

### Important Frontend Assumptions

- public list and details must stay available without a logged-in user;
- single-event responses provide `data` plus a `permissions` object;
- frontend expects specific event fields, including some that may not be guaranteed today;
- apply/edit flows assume clean route redirects and stable request shapes.

## 4. Existing Test Coverage

### Areas With Coverage

- event listing, details, creation, editing, deletion-like flows;
- application CRUD and status flows;
- export, boardview, european-event status, and upload flows;
- basic metrics endpoints.

### Areas With Weak Coverage

- direct helper behavior in `events/lib/helpers.js`;
- direct model validation in `events/models/Event.js` and `events/models/Application.js`;
- metric-name and request-label assertions;
- public field-contract assertions against frontend expectations;
- malformed or missing request body handling;
- upload replacement edge cases where old files are missing.

## 5. Mocking And Fixture Gaps

Add or normalize fixtures for:

- core main permissions vs approve permissions;
- malformed permission entries and empty body-permission sets;
- unsuccessful member/body fetches during export and board flows;
- upload replacement scenarios where previous files are already gone;
- public event payloads as actually consumed by the frontend.

## 6. Review Batch Plan

### Review Agent A: Package Architecture

- map all route groups, side effects, and public-vs-auth contract boundaries.

### Review Agent B: Tests And Fixtures

- inventory current API suites and identify where helper/model coverage is missing.

### Review Agent C: Frontend Usage

- trace event list, single, apply, edit, participants, board, and status flows.

### Review Agent D: Risk Review

- rank high-cost regressions in applications, exports, uploads, and public contracts.

## 7. Execution Batch Plan

### Stream 1: Metrics And Public Contract Tests

- assert metric names and request labels;
- assert public event fields that frontend views rely on.

### Stream 2: Helper And Model Contracts

- add direct tests for helper formatting, query building, permission derivation, and validation rules in `Event` and `Application`.

### Stream 3: Application Error Paths

- cover invalid or missing `body_id`, malformed answers, and controlled validation failures.

### Stream 4: Upload And Export Reliability

- cover missing-old-file replacement behavior and export-time core failure handling.

### Stream 5: Frontend Harness And Event Flows

- extend frontend unit harness to event list/apply/edit flows;
- assert redirects, permissions, and error handling.

## 8. Prioritized Backlog

### Priority 1

- metrics contracts;
- helper/model tests;
- application create error-path coverage.

### Priority 2

- public field-contract tests;
- upload replacement tests;
- frontend event list/apply/edit specs.

### Priority 3

- export reliability coverage;
- boardview/admin frontend coverage;
- fixture cleanup and contract snapshots.

## 9. Completion Criteria

- metrics and public contracts are asserted explicitly;
- helper/model behavior has direct tests;
- application error paths return controlled behavior;
- initial frontend event component coverage exists for highest-value flows;
- bug/improvement follow-ups are documented separately.

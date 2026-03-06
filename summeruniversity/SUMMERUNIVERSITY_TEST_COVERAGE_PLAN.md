# Summer University Test Coverage Plan

**Status:** In progress
**Owner:** `summeruniversity` contributors
**Last updated:** 2026-03-06

## 1. Objective

Bootstrap real coverage for `summeruniversity` so the package has a stable behavioral contract before larger backend changes.

This plan focuses on:

- creating a reusable local test harness by porting patterns from `events`;
- backend API, validation, and status-transition coverage;
- frontend expectations for list, single, apply, edit, participants, and board flows;
- documenting likely bugs and improvements discovered during the first review.

## 2. Current State

### Package Shape

- Runtime: CommonJS Node.js service with Express routes under `summeruniversity/lib/server.js`.
- Main modules:
  - `summeruniversity/lib/events.js`
  - `summeruniversity/lib/applications.js`
  - `summeruniversity/lib/helpers.js`
- Persistence: Sequelize models in `summeruniversity/models`.

### Current Test Shape

- `summeruniversity/package.json` expects Jest API tests, but there is currently no local `summeruniversity/test` tree.
- Effective package-local coverage is zero.

### High-Risk Areas

- status transitions during edit;
- partial edit payload handling;
- application creation with invalid `body_id`;
- hardcoded season logic;
- upload replacement failure handling;
- frontend route and permission assumptions.

## Progress Snapshot

Implemented on branch `docs/discounts-test-coverage-plan` so far:

- added `summeruniversity/SUMMERUNIVERSITY_FOLLOWUPS.md`;
- added package planning docs for summeruniversity;
- bootstrapped a first local test harness with `summeruniversity/test/scripts/generator.js`;
- added initial helper/model contract coverage in `summeruniversity/test/api/helpers-models.test.js`.

## 3. Consumer Map

### Frontend Consumers

- `frontend/src/views/summeruniversity/List.vue`
- `frontend/src/views/summeruniversity/Single.vue`
- `frontend/src/views/summeruniversity/Apply.vue`
- `frontend/src/views/summeruniversity/Edit.vue`
- `frontend/src/views/summeruniversity/Participants.vue`
- `frontend/src/views/summeruniversity/BoardView.vue`
- `frontend/src/views/summeruniversity/ChangeStatus.vue`

### Important Frontend Assumptions

- single-resource endpoints return `data` plus `permissions`;
- apply/edit pages assume stable route names and a populated `loginUser.bodies` list;
- list page expects permission-driven actions that may not currently be wired correctly.

## 4. Existing Test Coverage

- no package-local backend test suites;
- no frontend SU component tests;
- no explicit fixture strategy for SU-specific contracts.

## 5. Mocking And Fixture Gaps

Need initial fixtures for:

- core user and permission responses;
- SU event payloads with organizers, locations, questions, publication states, and season values;
- application payloads with answers, statuses, and cancellation states;
- mailer and upload success/failure envelopes.

## 6. Review Batch Plan

### Review Agent A: Backend Structure

- map events/applications/status/publication rules and copy opportunities from `events`.

### Review Agent B: Frontend Usage

- map list/single/apply/edit/participants/board/admin flows and route assumptions.

### Review Agent C: Bug And Drift Review

- document hardcoded seasons, route mismatches, edit-flow status bugs, and upload fragility.

## 7. Execution Batch Plan

### Stream 1: Test Harness Bootstrap

- create `summeruniversity/test` by copying and adapting `events/test` helpers, generators, and mock patterns.

### Stream 2: Event Editing And Status Contracts

- cover partial edit payloads, organizer handling, and status transitions.

### Stream 3: Application Creation And Validation

- cover invalid `body_id`, duplicate apps, question answers, and season rules.

### Stream 4: Metrics And Upload Reliability

- assert metric names/labels and upload replacement behavior.

### Stream 5: Frontend SU Harness And Flows

- reuse frontend harness patterns for list, apply, and edit flows.

## 8. Prioritized Backlog

### Priority 1

- harness bootstrap;
- event edit/status tests;
- application create error paths.

### Priority 2

- frontend list/apply/edit tests;
- metrics contracts;
- upload reliability tests.

### Priority 3

- participants/board/admin UI coverage;
- model-only suites and fixture cleanup.

## 9. Completion Criteria

- package-local test harness exists and runs in CI-ready form;
- core event/application rules have initial direct coverage;
- initial frontend SU component coverage exists for high-value flows;
- likely bugs and improvements are documented in a separate follow-up file.

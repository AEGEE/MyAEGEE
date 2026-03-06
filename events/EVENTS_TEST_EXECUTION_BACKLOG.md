# Events Test Execution Backlog

**Status:** In progress
**Source plan:** `events/EVENTS_TEST_COVERAGE_PLAN.md`
**Last updated:** 2026-03-06

## 1. Purpose

Turn the events coverage plan into parallel implementation streams that protect backend contracts and frontend expectations.

## 2. Shared Foundations

### Foundation A: Follow-Up And Fixture Notes

- document known bugs/improvements in `events/EVENTS_FOLLOWUPS.md`;
- normalize any new core fixture cases needed by helper/model and public-contract tests.

### Foundation B: Frontend Harness Reuse

- reuse and generalize the Vue unit harness created for discounts where possible.

Execution status:

- Foundation A completed
- Stream 1 partially completed
- Stream 2 partially completed

## 3. Parallel Workstreams

## Stream 1: Metrics And Public Contracts

### Scope

- `events/test/api/metrics.test.js`
- new public-contract API tests if needed

### Goal

- protect metric names/labels and public response fields used by the frontend.

## Stream 2: Helper And Model Contracts

### Scope

- `events/lib/helpers.js`
- `events/models/Event.js`
- `events/models/Application.js`

### Goal

- make validation and permission behavior explicit outside broad API tests.

## Stream 3: Application Error Paths

### Scope

- application creation/update API suites

### Goal

- ensure invalid `body_id`, malformed answers, and edge-case inputs fail cleanly.

## Stream 4: Upload And Export Reliability

### Scope

- upload and export API suites

### Goal

- protect partial-failure behavior and document current limitations.

## Stream 5: Frontend Event Flows

### Scope

- `frontend/src/views/events/*`

### Goal

- add initial component coverage for list, apply, and edit flows.

## 4. Recommended Execution Order

1. Foundation A
2. Stream 1
3. Stream 2
4. Stream 3
5. Foundation B
6. Stream 5
7. Stream 4

## 5. Handoff Format For Subagents

- `scope`
- `files changed`
- `tests added`
- `fixtures added or updated`
- `validation run`
- `follow-up gaps`

## 6. Implementation Notes

- prioritize contract assertions over implementation-specific mocking;
- keep frontend event specs focused on state and side effects when Buefy tables become noisy;
- document any backend/frontend route mismatches in `events/EVENTS_FOLLOWUPS.md` or `frontend/FRONTEND_FOLLOWUPS.md` as soon as they are confirmed.

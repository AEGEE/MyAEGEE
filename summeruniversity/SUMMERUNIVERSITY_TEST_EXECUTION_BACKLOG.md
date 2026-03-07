# Summer University Test Execution Backlog

**Status:** In progress
**Source plan:** `summeruniversity/SUMMERUNIVERSITY_TEST_COVERAGE_PLAN.md`
**Last updated:** 2026-03-06

## 1. Purpose

Turn the SU coverage plan into executable workstreams, with special emphasis on expanding the now-established package-local test harness.

## 2. Shared Foundations

### Foundation A: Follow-Up Notes

- keep package issues and improvement notes in `summeruniversity/SUMMERUNIVERSITY_FOLLOWUPS.md`.

### Foundation B: Test Harness Bootstrap

- extend the package-local `summeruniversity/test` tree with targeted API/unit coverage where gaps remain.

### Foundation C: Frontend Harness Reuse

- reuse the Vue unit harness pattern introduced for discounts and extend it for SU views.

Execution status:

- Foundation A completed
- Foundation B completed

## 3. Parallel Workstreams

## Stream 1: Event Edit And Status Rules

- cover description-only edits, status auto-transitions, and organizer payload assumptions.

## Stream 2: Application Create And Validation

- cover `body_id`, duplicate apps, answers, cancellation, and season rules.

## Stream 3: Metrics And Upload Reliability

- cover metric names/labels and missing-old-file replacement behavior.

## Stream 4: Frontend List And Apply Flows

- cover list permissions, route filtering, apply POST/PUT/cancel flows, and redirect bugs.

## Stream 5: Frontend Edit And Participants Flows

- cover edit load/save behavior, participants status actions, and board/body selection logic.

## 4. Recommended Execution Order

1. Foundation A
2. Foundation B
3. Stream 1
4. Stream 2
5. Foundation C
6. Stream 4
7. Stream 5
8. Stream 3

## 5. Handoff Format For Subagents

- `scope`
- `files changed`
- `tests added`
- `fixtures added or updated`
- `validation run`
- `follow-up gaps`

## 6. Implementation Notes

- copy from `events` aggressively for helpers and API test structure, then narrow to SU-specific rules;
- document every confirmed route mismatch or hardcoded-season issue in follow-up notes immediately;
- prefer the smallest high-value bootstrap that proves the harness and catches current regressions.

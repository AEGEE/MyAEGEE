# Test Coverage Workflow

**Status:** Active workflow
**Scope:** Reusable for any package in this repository
**Goal:** Build a test suite that preserves package behavior and contracts so the implementation behind the package can change with minimal test churn.

## 1. Principles

This workflow is intentionally contract-first.

- Tests should describe externally observable behavior before implementation details.
- A package should be replaceable behind the same API, data contracts, and side effects without rewriting the whole suite.
- Mocks should model realistic upstream and downstream contracts, not just happy-path payloads.
- Review work and implementation work should be split so multiple subagents can work in parallel.
- The output of the review batch should be concrete enough that a second batch can execute without rediscovering context.

## 2. What "Good Enough" Looks Like

A package is ready for larger refactors or backend replacement when:

- its main HTTP, event, or function contracts are covered by tests;
- its error semantics are covered, not just successful responses;
- its integrations with adjacent packages are represented by reusable fixtures;
- frontend consumers are tested against realistic response envelopes;
- the suite can tolerate internal rewrites as long as behavior stays the same.

## 3. Standard Deliverables

Every package test-coverage effort should produce these artifacts:

1. A package plan document in the package directory.
2. A ranked gap list with recommended test types.
3. A fixture inventory covering realistic upstream and downstream contracts.
4. A parallel execution backlog that can be picked up by implementation subagents.
5. A short completion checklist describing what must pass before the package is considered stable.

## 4. Two-Batch Workflow

### Batch 1: Review And Planning

The first batch does not change production code. Its purpose is to inspect the package, map risk, and produce execution-ready suggestions.

Recommended review subagents:

1. **Architecture reviewer**
   - Maps routes, handlers, models, adapters, queues, cron jobs, and side effects.
   - Identifies boundaries where behavior should remain stable across backend changes.

2. **Test and fixture reviewer**
   - Inventories existing tests, helpers, fixtures, and mocks.
   - Notes what is covered, what is missing, and where mocks are too shallow.

3. **Consumer reviewer**
   - Traces how the package is used by frontend or sibling services.
   - Captures real payload shapes, sequencing assumptions, and UI expectations.

4. **Risk reviewer**
   - Ranks behavior that is likely to regress during refactors.
   - Focuses on concurrency, validation, authorization, partial failures, and edge-case payloads.

### Batch 2: Test Execution

The second batch implements tests from the plan. It should be divided into independent workstreams so multiple subagents can land changes in parallel.

Recommended execution streams:

1. **Contract tests**
   - Endpoint or public API behavior.
   - Success, validation failure, authorization failure, missing resource, and dependency failure paths.

2. **Adapter and boundary tests**
   - Calls to external services.
   - Request shape, headers, response decoding, and error mapping.

3. **Fixture expansion**
   - Reusable realistic fixtures for users, permissions, payloads, error envelopes, and malformed responses.

4. **Consumer tests**
   - Frontend or downstream integration tests built around real contract envelopes.

5. **Edge and regression tests**
   - Concurrency, idempotency, quotas, ordering, retries, metrics, and failure recovery.

## 5. How To Split Work Across Parallel Subagents

The review batch should always return work in a format that the execution batch can consume directly.

Each finding should include:

- `area`: route, helper, adapter, model, frontend view, background job, or metrics path;
- `current coverage`: none, weak, partial, or strong;
- `risk`: low, medium, or high;
- `why it matters`: the user-visible or contract-level consequence;
- `recommended test type`: API, component, unit, integration, contract, or regression;
- `fixture needs`: exact payloads or mock cases required;
- `parallelizable`: yes or no.

Execution tasks should then be grouped so that each subagent owns one coherent slice with minimal overlap.

## 6. Review Checklist

Every package review should answer these questions.

### Architecture

- What are the package entry points?
- What are the stable contracts consumers depend on?
- Which modules perform external I/O?
- Where are validation, authorization, and error translation handled?

### Existing Tests

- Which areas already have tests?
- Are tests mostly unit, API, or end-to-end style?
- Which branches are not exercised?
- Which helpers or adapters are only covered indirectly?

### Mocks And Fixtures

- Which upstream systems are mocked today?
- Are mocks realistic, reusable, and explicit about response envelopes?
- Which important negative or malformed cases are missing?
- Do fixtures represent both backend and frontend expectations?

### Consumers

- Which frontend screens or sibling services use this package?
- Which fields are required, optional, or backfilled locally by consumers?
- Which multi-request flows could break if contracts drift?
- Are there consumer tests today?

### Risk

- Where could race conditions occur?
- Which behaviors depend on time windows, quotas, retries, or ordering?
- Which paths are currently hidden behind broad mocks or untested catch blocks?
- Which failures would be expensive to debug after a backend swap?

## 7. Mocking Strategy

Mocks should be upgraded from simplistic status toggles to contract fixtures.

### Minimum Fixture Categories

- valid success envelope;
- empty but valid envelope;
- permission denied;
- unauthorized;
- validation error;
- not found;
- upstream `success: false` envelope;
- transport or network error;
- malformed payload shape;
- partial success in multi-request flows.

### Rules

- Prefer reusable fixtures over inline literals when the same contract appears in multiple suites.
- Represent full response envelopes, not just `data` arrays.
- Include malformed payloads that exercise decoder and fallback logic.
- Model real sequencing, especially when one screen or route performs several requests.
- Keep fixtures owned by the consuming package if they represent consumer-specific assumptions.

## 8. Consumer-Focused Coverage

When a package is used by the frontend, consumer tests are part of backend replacement readiness.

At minimum, capture:

- happy path rendering;
- mixed-success flows across several requests;
- loading and empty states;
- authorization-driven UI changes;
- validation and error messages;
- route-level access assumptions;
- any local response normalization or backfilling done by the UI.

## 9. Prioritization Rules

Add tests in this order unless the package suggests a better local sequence:

1. business-critical workflows;
2. authorization and validation boundaries;
3. external service contracts;
4. consumer-visible flows;
5. edge cases and regression traps;
6. lower-level helper coverage.

## 10. Package Plan Template

Each package plan should follow this structure.

```md
# <Package Name> Test Coverage Plan

**Status:** Draft
**Owner:** <team or package owners>
**Last updated:** YYYY-MM-DD

## 1. Objective
## 2. Current State
## 3. Consumer Map
## 4. Existing Test Coverage
## 5. Mocking And Fixture Gaps
## 6. Review Batch Plan
## 7. Execution Batch Plan
## 8. Prioritized Backlog
## 9. Completion Criteria
```

## 11. Completion Criteria Template

A package effort is complete when:

- the planned high-priority tests exist;
- key consumer flows have coverage;
- fixtures cover realistic contract variants;
- tests pass locally and in CI;
- the package plan is updated to reflect any deferred gaps.

## 12. Turning A Plan Into Parallel Work

Once a package plan is drafted, the next step is to convert it into a small execution backlog that parallel subagents can pick up with minimal coordination.

### Step 1: Define Workstream Boundaries

Create workstreams that avoid overlapping edits as much as possible.

Preferred boundaries:

- backend contract tests;
- adapter and fixture work;
- helper and model tests;
- frontend harness work;
- frontend flow tests;
- metrics and operational paths.

Each workstream should have:

- a clear goal;
- specific files or directories in scope;
- fixture dependencies;
- explicit out-of-scope items;
- a suggested validation command.

### Step 2: Define A Handoff Format

Each review or implementation subagent should return findings in this shape:

- `scope`
- `files`
- `goal`
- `changes proposed`
- `fixtures required`
- `tests to add`
- `validation`
- `blocked by`

This makes it easier for a second batch of subagents to execute without repeating discovery.

### Step 3: Sequence Shared Foundations First

Before splitting broad implementation work, land any shared foundations that would otherwise cause conflicts:

- reusable fixtures;
- common test helpers;
- frontend test harness setup;
- shared factories or generators.

### Step 4: Prefer Thin, Reviewable Commits

For visibility across agents and humans, keep execution commits small and focused.

Recommended commit order:

1. fixture and helper groundwork;
2. highest-risk backend regression tests;
3. consumer-facing frontend tests;
4. lower-level cleanup and edge cases.

### Step 5: Track Deferred Gaps Explicitly

If a workstream discovers missing infrastructure or larger refactors, add them back to the package plan or issue tracker as explicit follow-up items instead of leaving them implicit.

## 13. Recommended File Locations

- Reusable workflow: `docs/TEST_COVERAGE_WORKFLOW.md`
- Package plans: `<package>/<PACKAGE_NAME>_TEST_COVERAGE_PLAN.md`
- Execution backlogs: `<package>/<PACKAGE_NAME>_TEST_EXECUTION_BACKLOG.md`

Examples:

- `discounts/DISCOUNTS_TEST_COVERAGE_PLAN.md`
- `discounts/DISCOUNTS_TEST_EXECUTION_BACKLOG.md`
- `core/CORE_TEST_COVERAGE_PLAN.md`
- `events/EVENTS_TEST_COVERAGE_PLAN.md`

## 14. Local Shared Postgres For Test Runs

Several packages use the same Postgres credentials in `test` config while pointing at `localhost:8085` for the app server.

Recommended local setup:

1. Start the shared database container:
   - `./scripts-server/shared-test-postgres.sh start`
2. Export the shared connection variables in your shell:
   - `eval "$(./scripts-server/shared-test-postgres.sh env)"`
3. Run package-local test setup and focused suites:
   - `cd events && NODE_ENV=test npm run db:setup && NODE_ENV=test npx jest --runInBand --forceExit --runTestsByPath test/api/helpers-models.test.js`

Notes:

- the shared DB listens on `127.0.0.1:55433`;
- credentials are `postgres` / `5ecr3t` to match package test configs;
- packages still use their own databases (`events-testing`, `network-testing`, `core-testing`, etc.), so the same container can be reused safely across packages.

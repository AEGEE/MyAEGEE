# Parallel Review Plan

## Goal

Create a repeatable review workflow that uses parallel subagents to review a large multi-package branch thoroughly, then consolidates the results into one actionable report.

## When to use this workflow

- The branch touches multiple packages or services.
- The PR summary includes cross-package behavior claims.
- There are shared contracts between backend, frontend, and service packages.
- Validation spans multiple test suites or runtimes.

## Review phases

### 1. Establish scope first

Before launching review agents, gather:

1. Current branch name.
2. Base branch.
3. Draft PR metadata.
4. Full diff against the base branch.
5. List of changed packages and shared root files.

Outputs from this phase:

- package list
- changed shared files
- PR title, body, validation commands
- rough risk map

### 2. Launch package-specific review agents in parallel

Create one review subagent per updated package.

Typical package agents:

- `core`
- `frontend`
- `discounts`
- `events`
- `summeruniversity`
- `statutory`
- `network`
- `mailer`

Each package agent should review:

- code changes in that package
- tests added or changed in that package
- package-specific docs or follow-up files
- directly relevant root files that affect that package
- whether the PR summary and validation claims match the actual diff

Each package agent should return only:

1. top findings with severity
2. missing tests or validation gaps
3. a package verdict

### 3. Launch cross-package contract agents in parallel

After package reviews are complete, launch dedicated contract agents.

Recommended agents:

1. `core -> others`
   - Check how core changes are reflected in frontend and service packages.

2. `frontend -> others`
   - Check whether frontend changes match backend/runtime behavior.

3. `others -> core`
   - Check whether shared assumptions introduced elsewhere are owned or tested in core.

4. `others -> frontend`
   - Check whether backend and service changes are reflected in user-facing flows.

Focus areas:

- auth token lifecycle
- permissions/profile payloads
- request/response envelopes
- metrics labels and conventions
- server lifecycle behavior
- image upload and cleanup behavior
- route and loading-state behavior
- shared mocks and fixtures

### 4. Consolidate and de-duplicate findings

One synthesizer pass should:

- merge duplicate findings from different agents
- elevate true cross-package blockers
- separate package-local issues from contract issues
- check whether the PR summary overstates fixes
- check whether validation commands actually cover the risky changes

The final report should be grouped into:

1. overall verdict
2. highest-impact blockers or warnings
3. per-package verdicts
4. cross-package contract mismatches
5. validation gaps
6. recommended fix order

## Recommended subagent prompts

### Package review prompt template

```text
Review the `<package>` changes on the current branch against `<base>` in <repo>. Do not modify code. Inspect the diff limited to `<package>/**` and any directly relevant shared files. Compare the draft PR summary and validation claims to what actually changed. Return only: 1) top findings with severity and file refs; 2) risks or missing tests; 3) a package verdict.
```

### Cross-package prompt template

```text
Analyze how changes in `<source>` are reflected in `<targets>` relative to `<base>` in <repo>. Do not modify code. Focus on contract compatibility, tests, mocks, validation coverage, and runtime behavior. Return only: 1) cross-package findings with severity and file refs; 2) mismatches between behavior and expectations; 3) an overall verdict.
```

## Review checklist

### Branch and PR

- Is the branch diff reviewed against the correct base branch?
- Does the PR summary match the actual code changes?
- Do listed validation commands cover the risky files that changed?

### Package reviews

- Are runtime fixes actually implemented, not only tested?
- Are tests asserting the intended behavior instead of blessing broken behavior?
- Are docs/follow-up files stale after the code changes?

### Cross-package reviews

- Did shared contracts change in one package but not another?
- Did mocks and fixtures track real runtime payloads?
- Did frontend flows track backend auth and validation behavior?
- Did sibling services adopt shared server or metrics conventions consistently?

## Execution tips

- Use one subagent per package for the first pass.
- Use separate cross-package agents for contract propagation.
- Keep each agent focused and ask for structured output only.
- Synthesize only after all parallel agents finish.
- Store the synthesized findings in a markdown file so fixes can be worked through one by one.

## Deliverables

After the review, write at least two markdown artifacts:

1. A findings file with verdicts, references, and fix order.
2. A workflow file describing how to repeat the review process.

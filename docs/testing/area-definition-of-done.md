# When an area is done

The frontend suites are filled area by area (see [README.md](README.md#areas)). A pull request
that finishes an area ticks every line below for it; copy the list into the pull request's
description.

## Specs

- [ ] Every routed view of the area has `e2e/ui/<area>/<view>.spec.ts` (or `<view>-<topic>`
      files), and every route of the area is opened by a behavioural spec. The coverage gate
      checks the second part.
- [ ] Every behavioural spec is green on `vue` and on `vue-mobile`. Each `@desktop-only` test has
      a reason of an accepted kind ([writing-ui-specs.md](writing-ui-specs.md#opting-out)); the
      pull request lists them, from `e2e/test-results-ui/desktop-only.json`.
- [ ] Every request that changes something has its body checked, and every handler a test
      registers is used (the suite fails for one that isn't).
- [ ] No `test.skip`, `test.fixme` or `test.fail`, no test that passes only on a retry: lint and
      the reporter are green. A bug a spec finds is fixed in a `fix(frontend)` commit of its own,
      or split out into its own pull request.
- [ ] Files that specs upload are in `e2e/ui/fixtures/<area>/`, small and made for the test.
- [ ] Answers for the smoke and axe runs of the area's pages are in
      `e2e/ui/support/smoke/<area>.ts` and nowhere else.

## Coverage

- [ ] `e2e/ui/support/coverage/<area>.json` says `"gate": "enforced"`, and the gate passes in CI:
      script lines at least 90 %, script branches 85 %, template branches 85 %
      ([coverage.md](coverage.md)). The description has the area's row of the coverage table.
- [ ] Every `istanbul ignore` comment and every `templateExceptions` entry that was added has a
      reason a reviewer accepted. The description lists them (the gate prints them as
      `COVERAGE-EXCEPTION-ADDED`).
- [ ] No `console.error` from the area's pages: once the gate is enforced they fail the tests.

## Accessibility

- [ ] `e2e/ui/support/a11y/<area>.json` is not higher for any page than on `stable`, and lower
      where the markup fixes helped: `npm run a11y:lower` was run and
      `node scripts/a11y-baseline.ts check-stale` is green ([accessibility.md](accessibility.md)).

## Real stack

- [ ] At least one flow `e2e/tests/<area>-<flow>.spec.ts` for the area's main path across
      services.
- [ ] `e2e/tests/<area>-contract.spec.ts` (or `<area>-<part>-contract.spec.ts` for an area that
      splits its factories) compares every new factory with the real answer
      (`npm run lint` fails for a factory without one). Every field is compared with a value on
      both sides, or listed in `gaps` with the reason nobody can fill it.

## CI

- [ ] A shard of `frontend-mocked-test` or `e2e-test` that takes longer than about six minutes:
      raise that job's `parallelism` ([running.md](running.md#ci)). Nothing else changes with it.
- [ ] The last area to be finished also enforces `shell`, shows its numbers, and makes the
      `frontend` statuses of Codecov binding ([coverage.md](coverage.md#codecov)).

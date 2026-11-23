# backend-test-utils

Test-only helpers for the Node services' jest suites and CI. How to use them:
[docs/testing/backend-openapi.md](../../docs/testing/backend-openapi.md).

| File | What |
|---|---|
| `openapi.js` | `createContract()` and `createRequestHook()`: checks each test response (and each accepted JSON request body) against `<service>/openapi.yaml` |
| `routes.js` | Records the routes `lib/server.js` registers (`instrumentExpress`, `listExpressRoutes`) and lists spec operations (`listSpecOperations`, `listOperations`) |
| `unexercised.js` | CLI: documented responses that no test produced |
| `check-coverage.js` | CLI: merges the CI shards' coverage and checks the service's `jest.coverageThreshold` |
| `check-codecov-builds.js` | CLI: checks `codecov.yml` `after_n_builds` against the uploads in `.circleci/config.yml` |
| `test/` | Their unit tests: `node --test packages/backend-test-utils/test/` |

There is no `package.json` and there are no dependencies of their own: `ajv`, `ajv-formats`,
`yaml` and `istanbul-lib-coverage` are resolved from the service being checked (`createRequire`),
or from `core` for `check-codecov-builds.js` and the unit tests. Services `require` these files by relative
path (`../../../packages/backend-test-utils/openapi`). Lint: `npx eslint packages/backend-test-utils`
from the root.

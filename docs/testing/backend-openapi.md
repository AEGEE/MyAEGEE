# Backend API contract: OpenAPI files, response checks and the coverage ratchet

This page is for anyone who adds or changes a route in one of the Node services (`core`,
`statutory`, `events`, `summeruniversity`, `network`, `discounts`), or writes their tests.

Each service gets one hand-written OpenAPI 3.1.1 file, `<service>/openapi.yaml`. The
service's existing jest tests prove that it is right:

| Check | What fails | Where it runs |
|---|---|---|
| Spec conventions | A response schema that is not closed, has no type or is empty, a JSON response without a schema, `x-free-form` without a reason, the `Todo` placeholder, a `4XX` range or `default` response, a misplaced or reasonless `x-untested` ("Spec conventions", below) | When the response check loads the spec, so in every jest run of the service; and `spec-lint.js` in the `openapi` CI job, for every spec in `redocly.yaml` |
| Response check | A response whose path, method, status, content type or body the spec does not document, including any field the schema does not list | Every `request()` in the service's jest tests |
| Request check | A JSON request body that the server accepted (2xx) but the spec rejects, or that went to an operation that documents no request body | Same |
| Route parity | A route in `lib/server.js` that the spec lacks, a spec operation that Express does not register, or a mount the recorder cannot see into | `test/unit/openapi-routes.test.js` in the service |
| Never exercised | A documented `(operation, status)` that no test produced, or an `x-untested` exemption for one that a test did produce | The service's `<service>-coverage` CI job |
| Lint | Invalid OpenAPI, an operation without `summary`, `operationId` or `x-permission`, unused components | `openapi` CI job (`npx redocly lint`) |
| Generated types | `packages/api-types/<service>.ts` out of date | `openapi` CI job (`npm run openapi:types:check`: generates the types and fails on any difference to the committed files; `openapi-typescript --check` cannot be used, because it stops at the first API in `redocly.yaml` that is up to date) |
| Coverage ratchet | Coverage of all CI shards together below the numbers in `<service>/package.json` | The service's `<service>-coverage` CI job, and a local unsharded `npm run test:ci` |
| Ratchet lowered | A pull request that lowers those numbers without an approved `Coverage-lowered` trailer | `openapi` CI job (`check-coverage-lowered.js`, all six services, the mailer and the dispatcher) |

The helpers live in [`packages/backend-test-utils/`](../../packages/backend-test-utils/). They
are test-only and have no dependencies of their own: `ajv`, `ajv-formats`, `yaml` and
`istanbul-lib-coverage` come from the service's devDependencies.

A service has none of this until the pull request that audits its routes writes its spec and
wires it up ("Wiring up a service", below). Until then its tests run as before.

## Describing a route

### The file

- `<service>/openapi.yaml`, next to `package.json`. One self-contained file per service: no
  `$ref` to another file (the response check refuses one) and no shared file between
  services. Copy the shared components below into each file instead.
- `openapi: 3.1.1`. Schemas are JSON Schema 2020-12: a nullable string is
  `type: [string, 'null']`, never `nullable: true`.
- Order: `openapi`, `info`, `servers`, `security`, `tags`, `paths` (in the order the routes
  appear in `lib/server.js`), then `components` (`securitySchemes`, `parameters`,
  `responses`, `schemas`, shared schemas first).
- `info.version: '1'` is the contract version, not the package version.
  `info.license: {name: ISC, identifier: ISC}`.
- `servers: [{url: /api/<service>}]`, the gateway prefix the frontend uses. Paths are the
  service-local paths that `lib/server.js` registers, the same ones the tests call.
- The repository's yamllint config allows no spaces inside braces: write `{type: string}`,
  not `{ type: string }`, and quote any flow-style value that contains a comma.
- Describe what the code does today, including the odd parts (for example core's login
  response has no `data`). Changing behaviour that a client can see is a separate change with
  its own pull request.

### Operations

| Item | Rule |
|---|---|
| `operationId` | camelCase `<verb><Resource>` (`listCourses`, `getCourse`, `submitApplication`), with the parent where it disambiguates (`listBodyMemberships`). Unique and stable: generated client functions are named after it. |
| `summary` | Required. One short phrase. |
| `tags` | One per handler module (`lib/courses.js` gives `courses`). |
| Path parameters | The Express name: `/bodies/{body_id}`. An alias that Express routes through the same path (`/members/me` through `/members/:user_id`) is not a separate path; give the parameter `type: [integer, string]` and say so in its description. |
| `x-permission` | Required (lint error). `none`, `authenticated`, the permission string (`manage:discounts`), or a short sentence for compound rules. |
| `security` | Global `security: [{XAuthToken: []}]`. Public routes: `security: []`. Optional login (core's `maybeAuthorize`): `security: [{}, {XAuthToken: []}]`. |
| Responses | Every status the route itself can return, one by one: the 2xx, and 400, 401, 403, 404, 409 and 422 where they occur. Never `500`. Ranges (`4XX`) and `default` fail the spec conventions check, because one test of any status in the range would count for all of them. |
| Implicit responses | Accepted without being listed, as long as the body is an `ErrorResponse`: **500** on any operation, and **400 on an operation with a JSON request body when the test sent text that is not valid JSON** (the invalid-JSON handler). Every other 400 is the route's own (a non-numeric id, a missing field checked by hand) and is listed and tested like any status. Every spec defines the `ErrorResponse` schema; a spec without it fails the convention check. |
| 422 | Always `$ref: '#/components/responses/ValidationFailed'`, which allows both error shapes. |
| JSON bodies | `application/json` and any `application/*+json` (such as `application/problem+json`) are JSON: they need a schema, and bodies are validated against it. |
| Non-JSON bodies | Document only the media type: `text/plain: {schema: {type: string}}` for Prometheus metrics, `text/csv: {}`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet: {}`. Media type parameters (`; charset=utf-8`) are ignored. Document `Content-Disposition` under the response's `headers`, and assert the file name in the test. |
| No body | A response without `content` must have an empty body. |
| Uploads | `multipart/form-data` request body, `type: string, contentMediaType: application/octet-stream` for the file. Multipart request bodies are not validated; the JSON response is. |
| `x-untested` | On the operation, a map from status to reason: `x-untested: {'403': 'needs a core that answers 403 on my_permissions'}`. It exempts that one response of that one operation from the never-exercised check, for example a branch that needs a broken core to reach. The status must be documented on the operation and the reason must not be empty. On a response entry or a shared component under `components/responses` it fails, because a shared response would exempt every operation that uses it. An exemption for a response that a test did produce fails as stale. A reviewer approves every one. |

### Schemas

Names are PascalCase: `<Model>` as returned, `<Model>Input` for create and update bodies
(`<Model>CreateInput` and `<Model>UpdateInput` only when they differ), `<Model>Response` and
`<Model>ListResponse` for envelopes, `<Model>With<Assoc>` for variants with includes,
`<Model><Field>` for a reused enum, and `Core<Model>` for a core entity embedded in another
service's response (with only the fields that service returns).

| Sequelize | Response schema |
|---|---|
| `STRING`, `STRING(n)`, `TEXT` | `type: string` (`maxLength` only on `Input` schemas) |
| `INTEGER`, `id` | `type: integer` |
| `BOOLEAN` | `type: boolean` |
| `DATE`, `created_at`, `updated_at` | `type: string, format: date-time` |
| `DATEONLY` | `type: string, format: date` |
| `DECIMAL` | `$ref: '#/components/schemas/Decimal'` (a string from Postgres, the sent value right after create or update). Tests compare with `Number(...)`. A value the handler computes in JavaScript is `type: number`. |
| `ENUM(...)` | `type: string, enum: [...]`, copied from the model without duplicates |
| `ARRAY(STRING)` | `type: array, items: {type: string}` |
| `JSONB` | The real structure if the code defines one, otherwise `x-free-form: <reason>` (below) |
| `VIRTUAL` | Included if `toJSON` includes it |
| `defaultScope` exclusions | Left out, so that a leaked field (a password) fails the tests |

Rules:

- **Nullable**: a column is nullable unless it has `allowNull: false`.
- **Required**: every key present in every response of that schema. Sequelize returns all
  columns after a create, so entity schemas normally require them all. A key that is only
  sometimes present is optional, which is different from nullable.
- **Closed**: every schema a response uses is closed, so that a field the API returns but the
  spec omits (a leaked password) fails the test. `Input` schemas stay open
  (`additionalProperties: true`), because Sequelize ignores unknown keys. The spec
  conventions check enforces this on every response schema, following `$ref`s ("Spec
  conventions", below).
- **Formats in responses**: only `date-time` and `date`. `Input` schemas may use any format.
- **Maps keyed by id**: `type: object, additionalProperties: <value schema>`, with fixed keys
  under `properties`. This counts as closed: every other key must match the value schema.
- **Free-form JSON**: a value that really has no fixed structure (a JSONB column each body
  fills with its own keys, the answers of an application) gets `x-free-form: <reason>` on its
  schema, for example `{type: object, x-free-form: 'answers to the questions each event defines'}`.
  Nothing inside it is checked, by the conventions check or by the response check. The reason is
  required, and the marker is easy to find with `grep -rn x-free-form */openapi.yaml`. Use it
  only where the code defines no structure; an open `{type: object}` without it fails.
  The conventions check prints how many `x-free-form` and `x-untested` markers each spec uses
  (`core/openapi.yaml: ok (x-free-form: 2, x-untested: 1)`), so a growing number shows in the CI log.
- **Responses that depend on the caller**: a key that only some callers get is optional. A
  different field set is a `oneOf` of closed variants (`User` and `UserLimited`), where the
  larger variant requires a key the smaller lacks. Say in the operation's `description` who
  gets which, and test each variant. Where a caller must not get a key (a comment only boards
  see), the test of that caller passes `openApiVariant: '<schema name>'` to `request()`: the
  response's `data` must then also match that variant, so a leaked key fails the check.
- **Sequelize join rows** (`body_membership` on a `belongsToMany` include) keep the Sequelize
  name, are required, and use the join model's schema, or a `<JoinModel>Link` schema when an
  include narrows the columns. The parent is a variant: `allOf: [Body]` plus the join row,
  closed with `unevaluatedProperties: false`.

### Spec conventions

Redocly cannot check these, so `packages/backend-test-utils/spec-lint.js` does. The response
check runs it when it loads the spec (every test then fails with the list until the spec is
fixed), and the `openapi` CI job runs it on every spec in `redocly.yaml`
(`node packages/backend-test-utils/spec-lint.js`, or `npm run openapi:lint` at the root). Each
problem names the operation, the status and the JSON pointer of the schema:

```text
openapi.yaml: 1 OpenAPI convention problem(s) (docs/testing/backend-openapi.md):
  GET /integrations 200 (listIntegrations): #/components/schemas/Integration: object schema is not closed; add additionalProperties: false (unevaluatedProperties: false when it uses allOf), additionalProperties: <value schema> for a map keyed by id, or x-free-form: <reason>
```

A problem in a shared component is reported once, for the first operation that uses it.

Every response schema is walked, through `$ref`s, `properties`, `items`, map values and
`allOf`/`oneOf`/`anyOf`:

| Rule | Message |
|---|---|
| A JSON response (`application/json`, `application/*+json`) has a schema | `a JSON response needs a schema` |
| A schema is not empty (`{}`, `true`, or only `description` and other annotations) | `empty schema accepts any value` |
| A schema has a `type`, or `allOf`/`oneOf`/`anyOf`, `const` or `enum` | `schema has no type` |
| A schema with `properties`, `additionalProperties` or `unevaluatedProperties` says `type: object` (Ajv's strict mode needs it) | `uses … without type: object` |
| An object is closed: `additionalProperties` or `unevaluatedProperties` is `false` or a schema | `object schema is not closed`, or `object schema is explicitly open` for `true` and `{}` |
| An array has `items` (or `prefixItems`), which are checked like any schema | `array schema has no items` |
| `allOf` does not extend a closed schema with more properties: the closed schema's own `unevaluatedProperties: false` rejects them | `allOf extends #/components/schemas/Code, which is closed and so rejects integration` |
| `x-free-form` and `x-untested` have a real reason: at least ten characters, and not a placeholder such as `todo` or `tbd` | `x-free-form needs a reason`, `… needs a real reason, not 'todo': say why in a few words` |
| The spec defines `components/schemas/ErrorResponse` | `every spec defines the ErrorResponse schema` |

How the closing rule treats composition:

- **`allOf` fragments**: a schema that applies to the same value as a closed parent (an item of
  the parent's `allOf`, `oneOf` or `anyOf`, followed through `$ref`) is a fragment. It may stay
  open, because the parent closes the value (like every schema with `properties`, it still
  says `type: object`, as it is checked on its own when it is a `$ref`): `Course` is
  `allOf: [Timestamps]` plus its own fields, with `unevaluatedProperties: false`, and
  `Timestamps` stays open. The same `Timestamps` used on its own, or by a parent that is not
  closed, fails. To share fields between two closed schemas (`Code` and `CodeWithIntegration`),
  put them in an open fragment (`CodeFields`) and close each leaf.
- **`oneOf`/`anyOf` variants** (responses that depend on the caller): each variant is closed on
  its own (`User` and `UserLimited`), or the parent that lists them sets
  `unevaluatedProperties: false`.
- **Maps keyed by id**: `additionalProperties: <value schema>` closes the object, and the value
  schema is checked like any other.
- **Nested objects and array items** are checked on their own: closing the envelope does not
  close `data`.
- `not`, `if` and `propertyNames` are not walked.

The other rules: no status ranges or `default` (`'4XX' is not allowed: list each status the
route returns`), `x-untested` only as an operation-level map (see "Operations"), and no `Todo`
(below).

### Building a large spec up

The file stays one file. While a pull request builds it, a response body that is not written
yet may refer to `$ref: '#/components/schemas/Todo'`, with
`Todo: {description: 'Placeholder, removed before review'}` in `components.schemas`. Paths,
methods and statuses are still checked; only those bodies are open.

- Local test runs accept `Todo` only with `OPENAPI_ALLOW_TODO=1` in the environment:
  `OPENAPI_ALLOW_TODO=1 npm run test:ci`. Without it, loading the spec fails on every reference
  (`refers to the Todo placeholder; write the real schema`) and on the component itself
  (`the placeholder must be gone before the pull request is ready`).
- CI never sets the flag, and `spec-lint.js` in the `openapi` job ignores it. So while `Todo`
  exists, the pull request's CI is red. That is the signal: the pull request deletes every
  reference and the component before it is marked ready.

There is no report-only mode and no list of unchecked operations.

### Shared components

Copy these into every service file. Core also sends `errors` as an arbitrary object, so its
`ErrorWithFields` is wider if a test shows that.

```yaml
components:
  securitySchemes:
    XAuthToken:
      type: apiKey
      in: header
      name: X-Auth-Token
      description: Access token issued by core. Other services check it against core on every request.
  parameters:
    Limit: {name: limit, in: query, schema: {type: integer, minimum: 1}}
    Offset: {name: offset, in: query, schema: {type: integer, minimum: 0}}
    Sort: {name: sort, in: query, schema: {type: string}}
    Direction: {name: direction, in: query, schema: {type: string, enum: [asc, desc]}}
  responses:
    BadRequest: {description: 'Malformed request, for example a non-numeric ID.', content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}}
    Unauthorized: {description: 'No token, or the token was rejected.', content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}}
    Forbidden: {description: 'Authenticated but not allowed (see x-permission).', content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}}
    NotFound: {description: 'A resource in the path does not exist.', content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}}
    ValidationFailed: {description: 'Validation failed.', content: {application/json: {schema: {$ref: '#/components/schemas/ErrorResponse'}}}}
  schemas:
    ErrorResponse:
      oneOf:
        - $ref: '#/components/schemas/ErrorWithMessage'
        - $ref: '#/components/schemas/ErrorWithFields'
    ErrorWithMessage:
      type: object
      required: [success, message]
      properties:
        success: {const: false}
        message: {type: string}
      additionalProperties: false
    ErrorWithFields:
      type: object
      required: [success, errors]
      properties:
        success: {const: false}
        errors:
          type: object
          additionalProperties: {type: array, items: {type: string}}
      additionalProperties: false
    MessageResponse:
      type: object
      required: [success, message]
      properties:
        success: {const: true}
        message: {type: string}
      additionalProperties: false
    ListMeta:
      type: object
      required: [count]
      properties:
        count: {type: integer, minimum: 0}
      additionalProperties: false
    Timestamps:
      type: object
      required: [created_at, updated_at]
      properties:
        created_at: {type: string, format: date-time}
        updated_at: {type: string, format: date-time}
    Decimal:
      description: Sequelize DECIMAL. A string when read from Postgres, the input value right after create or update.
      type: [string, number]
      pattern: '^-?[0-9]+(\.[0-9]+)?$'
```

Redocly's `no-unused-components` rule fails on a component nothing uses, so leave out the
ones a service does not need. A worked example of all of this, small enough to read in one
go, is the helper's fixture:
[`packages/backend-test-utils/test/fixtures/openapi.yaml`](../../packages/backend-test-utils/test/fixtures/openapi.yaml).

## How the response check works

Every API test calls `request()` in `<service>/test/scripts/helpers.js`. Once a service is
wired up, `request()` passes each response to the check, which:

1. Strips the query string and a trailing slash and matches the path and the method together
   against the spec's templates, literal segments before parameters from the left
   (`/members/me` before `/members/{user_id}`). Like Express, a `PUT /members/me` goes to
   `/members/{user_id}` when only `GET /members/me` is literal. No match: it fails with
   "no operation for PUT /x".
2. If the status is below 300 and the request had a JSON body, validates the body against the
   operation's JSON `requestBody` (`application/json` or `application/*+json`). A body sent
   to an operation that documents none fails. Bodies of rejected requests are not checked:
   those tests send invalid input on purpose. Multipart bodies are not checked.
3. Looks up the response by its exact status, then the implicit 500, and the implicit 400
   only for a request whose body was text that is not valid JSON. Not found: it
   fails and lists the documented statuses.
4. Without `content`, the body must be empty. Otherwise the `content-type` must be documented,
   and a JSON body is validated with Ajv, showing up to 10 errors.
5. Appends `METHOD template status` to the file named by `OPENAPI_HITS_FILE`, if set (see
   "Never exercised").

It fails by throwing, so the failure points at the test's `await request(...)` line:

```text
OpenAPI contract violation:
  GET /courses/56 -> 200 (getCourse): response body does not match /paths/~1courses~1{course_id}/get/responses/200:
  /data must NOT have unevaluated properties 'description'
  body: {"success":true,"data":{"id":56,"name":"cultellus","description":null,...}}
```

Fix the spec when the code is right, and the code (in its own pull request) when it is not.

**Deliberately unknown routes.** A test of the not-found handler passes
`skipOpenApi: '<reason>'` to `request()`. A skip without a reason throws. Use it for nothing
else.

## Wiring up a service

The pull request that writes a service's spec does all of this in one go:

1. `<service>/openapi.yaml`.
2. Its entry in `redocly.yaml`, alphabetically:

   ```yaml
   apis:
     <service>:
       root: ./<service>/openapi.yaml
       x-openapi-ts:
         output: ./packages/api-types/<service>.ts
   ```

   then `npx openapi-typescript` at the root, and commit `packages/api-types/<service>.ts`.
3. The hook in `test/scripts/helpers.js`:

   ```js
   const path = require('path');
   // Root-level shared helper; becomes a workspace package after the pnpm restructure.
   const { createRequestHook } = require('../../../packages/backend-test-utils/openapi');

   const checkResponse = createRequestHook({ serviceRoot: path.join(__dirname, '..', '..') });

   // at the end of request():
   const result = { statusCode: response.status, statusMessage: response.statusText, headers: Object.fromEntries(response.headers.entries()), body };
   checkResponse(options, fetchOptions, result);
   return result;
   ```

   In the services with `responseType: 'buffer'` (core, statutory, events,
   summeruniversity), call `checkResponse` before that early return too.

   And the hits file reset in `package.json`, `jest`:

   ```json
   "globalSetup": "<rootDir>/../packages/backend-test-utils/jest-global-setup.js"
   ```

   A service that has a `globalSetup` of its own (statutory) calls
   `require('../../../packages/backend-test-utils/openapi').resetHitsFile()` from it instead.
4. `test/unit/openapi-routes.test.js`, the route parity test:

   ```js
   const path = require('path');
   const express = require('express');

   const { createContract } = require('../../../packages/backend-test-utils/openapi');
   const { instrumentExpress, listExpressRoutes, listSpecOperations } = require('../../../packages/backend-test-utils/routes');

   describe('OpenAPI spec completeness', () => {
       let app;

       beforeAll(() => {
           const restore = instrumentExpress(express);
           try {
               // Must load after instrumentExpress() so that the router calls are recorded.
               // eslint-disable-next-line global-require
               ({ server: app } = require('../../lib/server'));
           } finally {
               restore();
           }
       });

       test('documents exactly the routes that lib/server.js registers', () => {
           const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
           const routes = listExpressRoutes(app);
           const documented = listSpecOperations(spec);

           expect({
               undocumented: routes.filter((r) => !documented.includes(r)),
               notInExpress: documented.filter((d) => !routes.includes(d))
           }).toEqual({ undocumented: [], notInExpress: [] });
       });
   });
   ```

   Express 5 keeps no mount paths on its router layers, so `instrumentExpress` records
   `Router#use` and `Router#route` while `lib/server.js` loads. Rather than list a wrong path
   or miss a route, `listExpressRoutes` throws on:

   - `all()` and Express pattern syntax (`*`, `{…}`) in a route path;
   - an array of mount paths, `use(['/a', '/b'], router)`, and any mount path that is not a
     string: mount each path with its own `use()`;
   - a mounted Express application, `use('/x', express())`: mount an `express.Router()`;
   - a handler mounted under a prefix with no router at that prefix,
     `use('/files', serveFiles)`: it may answer requests the test cannot see. Middleware at a
     prefix where a router is also mounted (`use('/single/:event_id', recordMountPath(…), EventsRouter)`)
     is that router's middleware and is fine. A handler that answers requests and shares its
     prefix with a router is not detected; register routes on routers.

   HEAD is ignored. In four services `npm test` runs only `test/api`; `npm run test:ci`, which
   CI runs, includes `test/unit`.
5. `skipOpenApi: '<reason>'` on the not-found handler tests.
6. The coverage ratchet in `package.json` and the CI changes below.
7. Its two swagger-ui lines in `dev-tools/docker/docker-compose.yml` (the comment there shows
   them).

The table-driven 401 and 404 sweeps (`test/api/authentication-required.test.js`,
`test/api/path-parameters.test.js`) take their rows from `listOperations(spec)` in
`routes.js`, which gives each operation's `auth` (`none`, `optional` or `required`), statuses
and path parameters.

## Never exercised

Every documented response needs a test that produces it: documenting a 403 obliges a 403 test.
In CI each shard writes its hits to a file, and after all shards finish:

```sh
node packages/backend-test-utils/unexercised.js <service> <hits files…>
```

lists every documented `(operation, status)` that no test produced and exits 1:

```text
Documented but never exercised (write the test, or exempt the response on its operation with x-untested: {'<status>': '<reason>'}):
  GET /codes/mine 401  (listMyCodes)
```

A response that cannot reasonably be produced is exempted on its operation,
`x-untested: {'403': '<reason>'}`, which a reviewer approves. The same command also fails
(under `Spec problems:`) on every spec conventions problem, including an exemption on a
response entry or a shared response, an empty reason, and a stale exemption:
`GET /integrations/{integration_id} 404: x-untested is stale, a test produced this response; remove the exemption`.

**The hits file.** Each jest run starts it afresh: the shared `globalSetup`
(`jest-global-setup.js`) writes a first line naming the run (`# openapi hits, jest run <pid>`),
and the check appends only to a file that this run started. A file left over from an earlier
run, or a service wired without the `globalSetup`, fails the first test that records a hit:
`OPENAPI_HITS_FILE … was not started by this jest run. Add the shared globalSetup …`. So hits
from an earlier local run can never hide a response that no test produces any more.

## Coverage ratchet

- The numbers live in `<service>/package.json`, `jest.coverageThreshold.global`, all four
  metrics to one decimal: `{"statements": 98.5, "branches": 92.9, "functions": 100, "lines": 98.7}`.
  A local unsharded `npm run test:ci` enforces them with jest's own check.
- CI shards each service's tests over several containers, and one shard alone never reaches
  the service's numbers. So each shard runs with `--coverageThreshold='{}'`, which turns
  jest's check off, and keeps its `coverage/coverage-final.json`. A follow-up job merges the
  shards and checks the merged report:

  ```sh
  node packages/backend-test-utils/check-coverage.js <service> --expect <parallelism> <coverage-*.json>
  ```

  `--expect` makes a lost shard fail the check instead of passing it with partial data.
- **Raising**: set each metric to the merged number rounded down to one decimal. The check
  prints `(raise to X)` when a metric is 0.5 points or more above its threshold. Any pull
  request may raise the numbers.
- **Lowering** needs the maintainer's approval, recorded as a trailer in a commit message on
  the branch:

  ```text
  Coverage-lowered: <service>: <why>
  ```

  The `openapi` CI job runs
  `node packages/backend-test-utils/check-coverage-lowered.js core statutory events summeruniversity network discounts mailer dispatcher`,
  which compares each service's four numbers with the merge base of the branch and
  `origin/stable`, and does the same for the mailer's `minimum_coverage` in
  `mailer/coveralls.json` and the dispatcher's `--cov-fail-under` in
  `dispatcher/pyproject.toml`. A lower or removed number without the trailer fails:
  `<service>: this branch lowers the coverage ratchet in <service>/package.json: branches 80 -> 79.5.`
  The trailer covers only that branch's commits, so the next pull request starts without it.
- **Exclusions** are `istanbul ignore` comments in the source with a reason after `--`:
  `/* istanbul ignore next -- unhandledRejection is process-level */`, or
  `/* istanbul ignore file -- process entry point */` for a whole file. `collectCoverageFrom`
  keeps include globs only. A bare ignore without a reason fails the coverage job.
- Codecov stays informational: its uploads and `target: auto` statuses are unchanged.

### CircleCI, per service

The service's `<service>-test` job keeps its parallelism and adds the hits file, the
threshold override and the workspace:

```yaml
      - run:
          name: Run <service> tests
          working_directory: ~/project/<service>
          command: |
            mkdir -p ~/shard
            TEST=$(circleci tests glob "test/**/*.test.js" | circleci tests split --split-by=timings)
            OPENAPI_HITS_FILE=$HOME/shard/openapi-hits-$CIRCLE_NODE_INDEX.txt \
            JEST_JUNIT_OUTPUT_DIR=$HOME/reports/jest npm run test:ci $TEST -- \
              --reporters=default --reporters=jest-junit --coverageThreshold='{}'
            cp coverage/coverage-final.json ~/shard/coverage-$CIRCLE_NODE_INDEX.json
      - persist_to_workspace:
          root: ~/shard
          paths: [.]
```

A new `<service>-coverage` job goes directly after it and joins the same workflow with
`requires: [<service>-test]`:

```yaml
  <service>-coverage:
    docker:
      - image: cimg/node:26.13.1
    steps:
      - checkout
      - node/install-packages:
          pkg-manager: npm
          app-dir: ~/project/<service>
          override-ci-command: npm ci --legacy-peer-deps
      - attach_workspace:
          at: ~/shard
      - run: node packages/backend-test-utils/check-coverage.js <service> --expect <parallelism> ~/shard/coverage-*.json
      - run: node packages/backend-test-utils/unexercised.js <service> ~/shard/openapi-hits-*.txt
      - run:
          name: Every coverage ignore has a reason
          command: "! grep -rnE 'istanbul ignore (next|if|else|file) *(\\*/|$)' <service>/lib <service>/models"
```

The small suites (events, summeruniversity, network, discounts) run unsharded:
`parallelism: 1` and `--expect 1`.

### `after_n_builds`

Codecov waits for `after_n_builds` uploads (`codecov.yml`, twice) before it reports. The
number is the sum of `parallelism` over the jobs with a `codecov/upload` step that run on
every push. A job that `requires` other jobs only uploads when those passed; it is counted too,
and its flag must be carried forward, so that a copy from the parent commit stands in for it
when it does not run (the frontend's `frontend-coverage`, see
[coverage.md](coverage.md#the-frontend-upload-is-carried-forward)). A pull request that adds or removes such a job, or changes its parallelism,
applies its own change to the value on `stable` when it rebases, and changes both lines.
`node packages/backend-test-utils/check-codecov-builds.js` checks it in the `openapi` job and
prints the expected value.

## Running locally

From a service directory, against any Postgres:

```sh
DB_PORT=5432 DB_USERNAME=postgres npm run test:ci
```

- `DB_USERNAME` (default `postgres`) is the database user. The services used to read
  `USERNAME`, which many desktops export as the login name.
- `TEST_PORT` (default 8085) is the port the test server listens on, so two services' suites
  can run side by side: `TEST_PORT=58085 npm run test:ci` in one, `TEST_PORT=58086` in the
  other. Two runs of the same service also need separate databases (separate Postgres
  instances), because each run drops and recreates `<service>-testing`.
- `OPENAPI_HITS_FILE=/tmp/hits.txt npm run test:ci`, then
  `node packages/backend-test-utils/unexercised.js <service> /tmp/hits.txt` from the root,
  shows the untested responses before CI does. The run starts the file afresh, so run the
  whole suite: hits from a run of one test file replace those of the last full run.
- `OPENAPI_ALLOW_TODO=1` accepts the `Todo` placeholder while a spec is being built (CI never
  does).

At the repository root:

| Command | What |
|---|---|
| `npm run openapi:lint` | `redocly lint` and `spec-lint.js`, every spec in `redocly.yaml` |
| `npm run openapi:types` | Regenerates `packages/api-types/` |
| `npm run openapi:check` | Both lints, the stale-types check and the helpers' unit tests, as in CI |
| `node --test packages/backend-test-utils/test/` | The helpers' unit tests |

## GitHub Actions (draft migration)

The draft GitHub Actions migration needs, besides what CircleCI has:

1. In its `test` job: append `--coverageThreshold='{}'`, set
   `OPENAPI_HITS_FILE=${{ runner.temp }}/openapi-hits.txt`, and upload
   `coverage/coverage-final.json` and the hits file as artifact
   `coverage-${{ matrix.service }}-${{ matrix.shard }}` (with a pinned
   `actions/upload-artifact` SHA).
2. A `coverage` job: `needs: [changes, test]`, a matrix over the services that ran, download with `pattern: coverage-<service>-*` and
   `merge-multiple: true`, then the `check-coverage.js` (with `--expect` set to the service's
   shard count) and `unexercised.js` commands above.
3. An `openapi` job with the steps of the CircleCI one (checkout with `fetch-depth: 0` for
   `check-coverage-lowered.js`). It runs when the plan script reports a change under
   `packages/`, in any `*/openapi.yaml` or `*/package.json`, in `redocly.yaml` or in `e2e/`.
4. In the plan script: `packages/` as a run-everything prefix and `redocly.yaml` as a
   run-everything file, plus `coverage` and `openapi` outputs. summeruniversity needs a
   shard count (`"shards": 1`), or its tests do not run at all.
5. `coverage` and `openapi` in the aggregating job's `needs`.

Jobs there are path-filtered, so no fixed upload count holds: `after_n_builds` and
`check-codecov-builds.js` go away in that migration (Codecov flags with `carryforward`
instead).

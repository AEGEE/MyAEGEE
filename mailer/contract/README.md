# Mail contract

`mail-templates.json` lists every mail template, the parameters it needs and examples of
them. The services send mails to the mailer (`POST /` with `template`, `parameters`, `to`,
`subject`, …); the mailer (Elixir) renders them today and the dispatcher (Python) is meant to
replace it. This file is what both sides are checked against.

| Check | Where | What it checks |
|---|---|---|
| `node --test mailer/contract/` | CI job `mail-contract` | the manifest is consistent; every example is valid; the mailer, the dispatcher and the manifest have the same templates; every `template:` in a service's `lib/` or `middlewares/` is a literal name from the manifest (a shorthand `template` property is a problem) and its file is in that template's `senders`; `sendMail` is used only as `<client>.sendMail(...)`, which is what the jest hook sees |
| `node mailer/contract/check-senders.cjs` | locally | the last of those checks alone, with one line per problem |
| ExUnit (`mailer/test/omsmailer_web/contract/`) | `mailer-test` | every example renders in the mailer, also with only its required keys and with every nullable value `null`; the paths each template reads are declared, and the ones it can't render without are required |
| pytest (`dispatcher/tests/test_contract_templates.py`) | `dispatcher-test` | the same for the dispatcher's templates |
| jest hook (`<service>/test/scripts/mail-contract.js`, `jest-hook.cjs`) | each service's `test` job | every mail a test sends matches its template's schema; the test fails afterwards otherwise. A test that sends an invalid mail on purpose calls `allowViolations()` of `jest-hook.cjs`. A mocked client is checked through the calls its mock recorded; a test file that mocks the client and gets no mail checked fails at its end, unless it calls `allowUncheckedMails('<reason>')`. `MAIL_CONTRACT_REPORT=<file>` writes how many mails each test file had checked |
| fake mailer (`e2e/support/fake-mailer.ts`) | `e2e-test` | every mail the real stack sends: the fake answers 404 for a template the manifest doesn't list and 422 for a mail that breaks its schema, as the mailer does, and the `mailContract` fixture of `e2e/support/api.ts` fails the test during which a mail was refused. A spec that sends an invalid mail on purpose calls `api.expectRefusedMail(template)` |

## Schemas

`parameters` of each template is a JSON Schema subset: `type` (a name or a list),
`properties`, `required`, `additionalProperties: false`, `items`, `enum`, `minLength`,
`minItems`, `$ref` to `#/$defs/<name>` and `description`. Any other keyword is an error, so
the validator stays small and has no dependencies.

- `required` lists every path the template reads that every sender sends. The dispatcher
  fails on a missing value, so anything optional must be read with a default there.
- Extra properties are allowed: services pass whole records.
- What a template prints is a string, number, boolean or `null`; what it loops over is an
  array. A nullable column is `["string", "null"]`.
- `senders` names the files that send the template; `unused: "<reason>"` marks one kept
  without a sender. Every sender file has an example with `"sender": "<file>"`.
- `per_recipient_parameters: true` (only `custom`): `parameters` may be a list with one object
  per address in `to`.

## Adding or changing a mail

In one pull request:

1. Add or change the template in `mailer/lib/omsmailer_web/templates/page/` and in
   `dispatcher/templates/`.
2. Add or change its entry in `mail-templates.json`: description, senders, the parameter
   schema and an example per sender file. Take the example from what the service really
   sends: run the service's tests with `MAIL_CONTRACT_CAPTURE=/tmp/mails npm run test:ci`,
   which writes the first three mails per template and test file to that directory, and
   replace personal data and trim long records.
3. Send it from the service with a literal template name (`template: 'name.html'`).

The service's jest suite then checks what the service sends, and the mailer's and the
dispatcher's tests render the example.

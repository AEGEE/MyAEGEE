# Generated API types

**Generated, do not edit.** One file per service, `<service>.ts`, generated from
`<service>/openapi.yaml` by `npx openapi-typescript` at the repository root (configured in
`redocly.yaml`). CI fails when a file here is out of date (`npm run openapi:types:check`, which generates them and compares them with the committed files).

Each service's file is added by the pull request that writes the service's OpenAPI file.
Import the types only, with the `.ts` extension, so that nothing is loaded at run time:

```ts
import type { components } from '../../packages/api-types/events.ts';
```

How the specs are written and checked: [docs/testing/backend-openapi.md](../../docs/testing/backend-openapi.md).

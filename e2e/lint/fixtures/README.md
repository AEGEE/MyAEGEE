# Fixtures for the lint rules

Each file is linted by `lint/rules.test.js` (part of `npm run lint`) with the configuration of
`e2e/.eslintrc.cjs`, as if it were the file its first line names:

```ts
// lint-as: ui/events/example.spec.ts
```

A line that a rule must report has `// expect-lint: <rule>[, <rule>]` on the line above it.
Every other line must be reported by none of the rules that guard the tests (the `e2e-*` rules,
`no-restricted-syntax` and the rule that asks for a reason on `eslint-disable`). So each file
shows both what a rule refuses and what it lets through.

The files are neither type-checked nor linted on their own, and no suite runs them.

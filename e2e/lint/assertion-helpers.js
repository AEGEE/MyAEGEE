// The suite's own functions that assert by themselves. A test that calls one of them checks
// something, also without an `expect` of its own (lint rule e2e-expect-expect). A helper that
// belongs here fails the test when what it looks at is wrong, and is named `expect…`.
module.exports = [
    // support/api.ts: the status of a real service's answer.
    'expectStatus',
    // support/contract.ts: a mock factory against a real service's answer.
    'expectShape',
    // ui/support/shell.ts: a table that shows its "nothing here" state.
    'expectEmptyTable'
];

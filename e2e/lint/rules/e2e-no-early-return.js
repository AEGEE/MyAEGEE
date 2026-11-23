// A `return` in the body of a test ends it before the assertions that follow, and the test is
// green. With a condition in front it is a skip that nobody sees. The same goes for a step that
// returns before its end, and for a `describe` that returns before it has declared its tests.
const { kindOfCallback, nearestFunction } = require('../ast.js');

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'no return in the body of a test or a describe, and none before the end of a step' },
        schema: [],
        messages: {
            early: 'A test doesn\'t return early: what comes after the `return` is never checked, and the test is green. Every test runs to its end on both projects; one that can\'t run on a phone is tagged @desktop-only with a reason.',
            step: 'A step returns its result with its last statement only: a `return` before that leaves out the rest of the step, and the test is green. Run every step to its end.',
            describe: 'A `describe` doesn\'t return: the tests after the `return` are never declared, so they are skipped without anyone seeing it. Declare every test; one for a single project is tagged @desktop-only (with a reason) or @phone-only.'
        }
    },
    create: (context) => ({
        ReturnStatement(node) {
            const fn = nearestFunction(node);
            const kind = fn && kindOfCallback(fn);
            if (kind === 'test') context.report({ node, messageId: 'early' });
            if (kind === 'describe') context.report({ node, messageId: 'describe' });
            // `return (await names())[0];` as the last statement of a step is its result.
            if (kind === 'step' && fn.body.body.at(-1) !== node) context.report({ node, messageId: 'step' });
        }
    })
};

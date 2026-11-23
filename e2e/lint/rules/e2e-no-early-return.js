// A `return` in the body of a test ends it before the assertions that follow, and the test is
// green. With a condition in front it is a skip that nobody sees.
const { kindOfCallback, nearestFunction } = require('../ast.js');

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'no return in the body of a test' },
        schema: [],
        messages: {
            early: 'A test doesn\'t return early: what comes after the `return` is never checked, and the test is green. Every test runs to its end on both projects; one that can\'t run on a phone is tagged @desktop-only with a reason.'
        }
    },
    create: (context) => ({
        ReturnStatement(node) {
            const fn = nearestFunction(node);
            if (fn && kindOfCallback(fn) === 'test') context.report({ node, messageId: 'early' });
        }
    })
};

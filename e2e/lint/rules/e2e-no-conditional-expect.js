// An assertion that only runs under a condition, or whose failure is caught, lets a test pass
// without having checked anything.
const { isAssertion, isFunction, kindOfCallback } = require('../ast.js');

const why = (parent, child) => {
    switch (parent.type) {
    case 'IfStatement': return child !== parent.test ? 'conditional' : undefined;
    case 'ConditionalExpression': return child !== parent.test ? 'conditional' : undefined;
    case 'LogicalExpression': return child === parent.right ? 'conditional' : undefined;
    case 'SwitchCase': return child !== parent.test ? 'conditional' : undefined;
    case 'CatchClause': return 'caught';
    case 'TryStatement': return child === parent.block && parent.handler ? 'swallowed' : undefined;
    default: return undefined;
    }
};

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'no assertion under a condition or inside try/catch' },
        schema: [],
        messages: {
            conditional: 'This assertion only runs when a condition holds, so the test can pass without checking anything. Make the test set up the one case it is about and assert without a condition (two cases are two tests).',
            caught: 'This assertion only runs when something threw. Assert what the page shows instead: `await expect(…).rejects` for a promise, or the error message on the page.',
            swallowed: 'A failed assertion inside `try` is caught by the `catch` below it, and the test stays green. Assert outside the try block, or use try/finally without a catch.'
        }
    },
    create: (context) => ({
        CallExpression(node) {
            if (!isAssertion(node)) return;
            let child = node;
            for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
                // A test declared under a condition is e2e-no-skipped-tests's business.
                if (isFunction(parent) && ['test', 'hook'].includes(kindOfCallback(parent))) return;
                const messageId = why(parent, child);
                if (messageId) {
                    context.report({ node, messageId });
                    return;
                }
            }
        }
    })
};

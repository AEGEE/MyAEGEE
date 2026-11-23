// How the suite runs is decided in one place, the Playwright config. A spec may not give
// itself retries (a test that needs a second try is broken), run its tests in serial mode,
// or take the time limit away.
const { keyName, propertyName } = require('../ast.js');

const rootName = (node) => {
    let current = node;
    while (current && (current.type === 'MemberExpression' || current.type === 'CallExpression')) {
        current = current.type === 'MemberExpression' ? current.object : current.callee;
    }
    return current && current.type === 'Identifier' ? current.name : undefined;
};

const isZero = (node) => node && node.type === 'Literal' && node.value === 0;

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'no retries, serial mode or unlimited timeout in a spec' },
        schema: [],
        messages: {
            retries: 'A spec doesn\'t set `retries`: a test that only passes on a second try is flaky, and the run reports it as a failure. Find out what it waits for too briefly and fix that.',
            serial: 'No serial mode: its tests lean on what the one before left behind, and all of them are skipped after the first failure. Every test sets up what it needs and passes alone, in any order.',
            timeout: 'A time limit of 0 is no limit: a test that hangs would hang the run. Use `test.slow()` or a real limit.'
        }
    },
    create: (context) => ({
        'ObjectExpression > Property': (node) => {
            const name = keyName(node);
            if (name === 'retries') context.report({ node, messageId: 'retries' });
            if (name === 'mode' && node.value.type === 'Literal' && node.value.value === 'serial') context.report({ node, messageId: 'serial' });
            // test.use({ … }), test.describe.configure({ … }), test('…', { … }, …)
            const call = node.parent.parent;
            if (name === 'timeout' && isZero(node.value) && call.type === 'CallExpression' && ['test', 'it'].includes(rootName(call.callee))) {
                context.report({ node, messageId: 'timeout' });
            }
        },
        // test.describe.serial(…)
        MemberExpression(node) {
            if (propertyName(node) === 'serial' && ['test', 'it'].includes(rootName(node))) context.report({ node: node.property, messageId: 'serial' });
        },
        // test.setTimeout(0)
        CallExpression(node) {
            if (propertyName(node.callee) === 'setTimeout' && ['test', 'it', 'testInfo'].includes(rootName(node.callee)) && isZero(node.arguments[0])) {
                context.report({ node, messageId: 'timeout' });
            }
        }
    })
};

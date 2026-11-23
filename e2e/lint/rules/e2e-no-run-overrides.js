// How the suite runs is decided in one place, the Playwright config. A spec may not give
// itself retries (a test that needs a second try is broken), run its tests in serial mode,
// or take the time limit away.
const { comesFromTest, keyName, propertyName, unwrap, variableOf } = require('../ast.js');

const isZero = (node) => node && node.type === 'Literal' && node.value === 0;

// The object a call is given: written in place, or a `const` of the file.
const objectOf = (argument, sourceCode) => {
    const node = unwrap(argument);
    if (!node) return undefined;
    if (node.type === 'ObjectExpression') return node;
    if (node.type !== 'Identifier') return undefined;
    const [def] = variableOf(sourceCode, node)?.defs ?? [];
    const init = def && def.type === 'Variable' ? unwrap(def.node.init) : undefined;
    return init && init.type === 'ObjectExpression' ? init : undefined;
};

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
        // test.describe.serial(…)
        MemberExpression(node) {
            if (propertyName(node) === 'serial' && comesFromTest(node.object, context.sourceCode)) context.report({ node: node.property, messageId: 'serial' });
        },
        CallExpression(node) {
            // Only what Playwright is given: `retries` or `mode: 'serial'` in an answer of the
            // API mock or in a form's data is somebody else's.
            if (!comesFromTest(node.callee, context.sourceCode)) return;
            // test.setTimeout(0), testInfo.setTimeout(0)
            if (propertyName(node.callee) === 'setTimeout' && isZero(node.arguments[0])) context.report({ node, messageId: 'timeout' });
            // test.use({ … }), test.describe.configure({ … }), test('…', { … }, …)
            for (const argument of node.arguments) {
                for (const property of objectOf(argument, context.sourceCode)?.properties ?? []) {
                    const name = keyName(property);
                    if (name === 'retries') context.report({ node: property, messageId: 'retries' });
                    if (name === 'mode' && property.value.type === 'Literal' && property.value.value === 'serial') context.report({ node: property, messageId: 'serial' });
                    if (name === 'timeout' && isZero(property.value)) context.report({ node: property, messageId: 'timeout' });
                }
            }
        }
    })
};

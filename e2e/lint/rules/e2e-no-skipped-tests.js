// The suite has no skipped tests, no expected failures and no focused tests. This catches
// every way to write one: test.skip/fixme/fail/only and their describe and step forms, the same
// under another name or through testInfo, a skip written as an annotation, and a test that is
// only declared when a condition holds.
const { callbackOf, isFunction, keyName, kindOfCall, kindOfCallback, propertyName } = require('../ast.js');

const MODIFIERS = new Set(['skip', 'fixme', 'fail', 'only']);

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'no skipped tests, expected failures or focused tests, however they are written' },
        schema: [],
        messages: {
            modifier: 'The suite has no skipped tests, expected failures or focused tests (`.{{name}}`): fix the page or the test. A test that can\'t run on a phone is tagged @desktop-only with a reason.',
            annotation: 'An annotation of the type \'{{name}}\' skips the test or expects it to fail: the suite has neither. Fix the page or the test.',
            expectedStatus: 'Setting expectedStatus makes a failing or skipped test green: the suite has no expected failures.',
            conditional: 'A test declared under a condition is a skipped test nobody sees when the condition is false. Declare it always; a test for one project only is tagged @desktop-only (with a reason) or @phone-only.'
        }
    },
    create: (context) => ({
        // test.skip, test.describe.fixme, test.step.skip, testInfo.fail, test.info().skip, it.only, test['skip']
        MemberExpression(node) {
            const name = propertyName(node);
            if (MODIFIERS.has(name)) context.report({ node: node.property, messageId: 'modifier', data: { name } });
            // testInfo.expectedStatus = 'failed'
            if (name === 'expectedStatus' && node.parent.type === 'AssignmentExpression' && node.parent.left === node) {
                context.report({ node, messageId: 'expectedStatus' });
            }
        },
        // const { skip } = test
        'ObjectPattern > Property': (node) => {
            const name = keyName(node);
            if (MODIFIERS.has(name)) context.report({ node: node.key, messageId: 'modifier', data: { name } });
        },
        // test('…', { annotation: { type: 'skip' } }, …) and annotation: [{ type: 'fixme' }]
        'Property[key.name="annotation"] ObjectExpression > Property': (node) => {
            if (keyName(node) !== 'type' || node.value.type !== 'Literal' || !['skip', 'fixme', 'fail'].includes(node.value.value)) return;
            context.report({ node, messageId: 'annotation', data: { name: node.value.value } });
        },
        // if (condition) test(…), condition && test.describe(…), condition ? test(…) : undefined
        CallExpression(node) {
            if (!['test', 'describe'].includes(kindOfCall(node)) || !callbackOf(node)) return;
            let child = node;
            for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
                // Inside a describe() that is itself under a condition: that one is reported.
                if (isFunction(parent) && kindOfCallback(parent) === 'describe') return;
                const conditional = ((parent.type === 'IfStatement' || parent.type === 'ConditionalExpression') && child !== parent.test)
                    || (parent.type === 'LogicalExpression' && child === parent.right)
                    || (parent.type === 'SwitchCase' && child !== parent.test);
                if (conditional) {
                    context.report({ node: node.callee, messageId: 'conditional' });
                    return;
                }
            }
        }
    })
};

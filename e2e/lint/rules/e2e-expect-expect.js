// A test without an assertion passes whatever the page does. An assertion is expect(…),
// expect.soft(…), expect.poll(…), one of the suite's own asserting helpers
// (lint/assertion-helpers.js), or a call to a function of the same file that asserts.
const { ASSERTION_HELPERS, callbackOf, isAssertion, isFunction, kindOfCall } = require('../ast.js');

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'every test asserts something' },
        schema: [],
        messages: {
            none: `This test asserts nothing, so it passes whatever the page does. Add an expect(), or one of the suite's asserting helpers (${ASSERTION_HELPERS.join(', ')}: e2e/lint/assertion-helpers.js).`
        }
    },
    create(context) {
        // Per function of the file: whether it asserts itself, and which functions it calls by name.
        const facts = new Map();
        // Functions that have a name in this file (declarations, and `const name = () => …`).
        const named = new Map();
        const tests = [];
        const stack = [];

        const enter = (node) => {
            facts.set(node, { asserts: false, calls: new Set() });
            stack.push(node);
            if (node.type === 'FunctionDeclaration' && node.id) named.set(node.id.name, node);
            else if (node.parent.type === 'VariableDeclarator' && node.parent.id.type === 'Identifier') named.set(node.parent.id.name, node);
        };
        const leave = () => { stack.pop(); };

        const asserts = (fn, seen = new Set()) => {
            if (seen.has(fn)) return false;
            seen.add(fn);
            const fact = facts.get(fn);
            if (!fact) return false;
            return fact.asserts || [...fact.calls].some((name) => named.has(name) && asserts(named.get(name), seen));
        };

        return {
            FunctionDeclaration: enter,
            FunctionExpression: enter,
            ArrowFunctionExpression: enter,
            'FunctionDeclaration:exit': leave,
            'FunctionExpression:exit': leave,
            'ArrowFunctionExpression:exit': leave,
            CallExpression(node) {
                // What a nested callback asserts or calls counts for every function around it.
                if (isAssertion(node)) stack.forEach((fn) => { facts.get(fn).asserts = true; });
                else if (node.callee.type === 'Identifier') stack.forEach((fn) => facts.get(fn).calls.add(node.callee.name));

                if (kindOfCall(node) !== 'test') return;
                const last = node.arguments[node.arguments.length - 1];
                // test('title', async () => { … }) or test('title', aFunctionOfThisFile)
                if (callbackOf(node)) tests.push({ node, body: () => callbackOf(node) });
                else if (last && last.type === 'Identifier' && node.arguments.length > 1) tests.push({ node, body: () => named.get(last.name) });
            },
            'Program:exit': () => {
                for (const { node, body } of tests) {
                    const fn = body();
                    // A callback from another file can't be looked into.
                    if (fn && isFunction(fn) && !asserts(fn)) context.report({ node: node.callee, messageId: 'none' });
                }
            }
        };
    }
};

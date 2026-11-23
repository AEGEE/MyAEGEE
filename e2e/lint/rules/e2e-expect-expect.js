// A test without an assertion passes whatever the page does. An assertion is expect(…),
// expect.soft(…), expect.poll(…), one of the suite's own asserting helpers
// (lint/assertion-helpers.js), or a call to a function of the same file that asserts.
// An assertion in a loop that may run zero times (over the rows a page happens to show) is not
// enough by itself: with nothing to loop over, the test asserts nothing.
const { ASSERTION_HELPERS, callbackOf, isAssertion, isFunction, kindOfCall, propertyName, unwrap, variableOf } = require('../ast.js');

// Array methods that call their callback once per item, so not at all for an empty array.
const ITERATORS = new Set(['forEach', 'map', 'flatMap', 'filter', 'every', 'some', 'find', 'findIndex', 'reduce']);

// Whether a loop over `node` runs at least once: a list written out in the file.
const isFilledList = (node, sourceCode, seen = new Set()) => {
    const list = unwrap(node);
    if (!list) return false;
    if (list.type === 'ArrayExpression') return list.elements.some((element) => element && element.type !== 'SpreadElement');
    // [...].entries() and Object.entries({ … }) of such a list
    if (list.type === 'CallExpression' && list.callee.type === 'MemberExpression') {
        if (propertyName(list.callee) === 'entries' && list.arguments.length === 0) return isFilledList(list.callee.object, sourceCode, seen);
        const object = unwrap(list.arguments[0]);
        return list.callee.object.type === 'Identifier' && list.callee.object.name === 'Object' && ['entries', 'keys', 'values'].includes(propertyName(list.callee))
            && !!object && object.type === 'ObjectExpression' && object.properties.some((property) => property.type === 'Property');
    }
    if (list.type !== 'Identifier') return false;
    const variable = variableOf(sourceCode, list);
    if (!variable || seen.has(variable) || variable.defs.length !== 1) return false;
    seen.add(variable);
    const [def] = variable.defs;
    return def.type === 'Variable' && def.parent.kind === 'const' && def.node.id.type === 'Identifier' && isFilledList(def.node.init, sourceCode, seen);
};

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'every test asserts something' },
        schema: [],
        messages: {
            none: `This test asserts nothing, so it passes whatever the page does. Add an expect(), or one of the suite's asserting helpers (${ASSERTION_HELPERS.join(', ')}: e2e/lint/assertion-helpers.js).`,
            onlyInLoop: 'The assertions of this test are all inside a loop that may run zero times, and then the test asserts nothing. Assert how many items there are before the loop (`await expect(rows).toHaveCount(3)`), or loop over a list written out in the spec.'
        }
    },
    create(context) {
        // Per function of the file: whether it asserts itself, and which functions it calls by
        // name; both also for what only happens inside a loop that may not run (`InLoop`).
        const facts = new Map();
        // Functions that have a name in this file (declarations, and `const name = () => …`).
        const named = new Map();
        const tests = [];
        // The functions around the current node, each with the number of loops between it and the node.
        const stack = [];

        const loopStarts = () => { stack.forEach((entry) => { entry.loops += 1; }); };
        const loopEnds = () => { stack.forEach((entry) => { entry.loops -= 1; }); };

        // rows.forEach((row) => expect(row)…): the callback is the body of a loop.
        const isLoopBody = (fn) => {
            const { parent } = fn;
            return parent.type === 'CallExpression' && parent.arguments.includes(fn) && parent.callee.type === 'MemberExpression'
                && ITERATORS.has(propertyName(parent.callee)) && !isFilledList(parent.callee.object, context.sourceCode);
        };

        const enter = (node) => {
            if (isLoopBody(node)) loopStarts();
            facts.set(node, { asserts: false, assertsInLoop: false, calls: new Set(), callsInLoop: new Set() });
            stack.push({ fn: node, loops: 0 });
            if (node.type === 'FunctionDeclaration' && node.id) named.set(node.id.name, node);
            else if (node.parent.type === 'VariableDeclarator' && node.parent.id.type === 'Identifier') named.set(node.parent.id.name, node);
        };
        const leave = (node) => {
            stack.pop();
            if (isLoopBody(node)) loopEnds();
        };

        // 'always', 'inLoop' (only where a loop may not run) or undefined.
        const asserts = (fn, seen = new Set()) => {
            if (seen.has(fn)) return undefined;
            seen.add(fn);
            const fact = facts.get(fn);
            if (!fact) return undefined;
            const through = (names) => [...names].map((name) => (named.has(name) ? asserts(named.get(name), new Set(seen)) : undefined));
            const direct = through(fact.calls);
            if (fact.asserts || direct.includes('always')) return 'always';
            return fact.assertsInLoop || direct.includes('inLoop') || through(fact.callsInLoop).some(Boolean) ? 'inLoop' : undefined;
        };

        const loop = {
            ForStatement: loopStarts,
            'ForStatement:exit': loopEnds,
            WhileStatement: loopStarts,
            'WhileStatement:exit': loopEnds,
            ForInStatement: loopStarts,
            'ForInStatement:exit': loopEnds,
            // for (const action of ['View applications', 'Edit event']) always runs.
            ForOfStatement(node) { if (!isFilledList(node.right, context.sourceCode)) loopStarts(); },
            'ForOfStatement:exit': (node) => { if (!isFilledList(node.right, context.sourceCode)) loopEnds(); }
        };

        return {
            ...loop,
            FunctionDeclaration: enter,
            FunctionExpression: enter,
            ArrowFunctionExpression: enter,
            'FunctionDeclaration:exit': leave,
            'FunctionExpression:exit': leave,
            'ArrowFunctionExpression:exit': leave,
            CallExpression(node) {
                // What a nested callback asserts or calls counts for every function around it.
                if (isAssertion(node)) {
                    stack.forEach(({ fn, loops }) => { facts.get(fn)[loops ? 'assertsInLoop' : 'asserts'] = true; });
                } else if (node.callee.type === 'Identifier') {
                    stack.forEach(({ fn, loops }) => facts.get(fn)[loops ? 'callsInLoop' : 'calls'].add(node.callee.name));
                }

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
                    if (!fn || !isFunction(fn)) continue;
                    const how = asserts(fn);
                    if (how !== 'always') context.report({ node: node.callee, messageId: how === 'inLoop' ? 'onlyInLoop' : 'none' });
                }
            }
        };
    }
};

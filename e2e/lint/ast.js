// What the rules in rules/ share: recognising Playwright's test(), hooks and expect() in the
// syntax tree.
const ASSERTION_HELPERS = require('./assertion-helpers.js');

const TEST_NAMES = new Set(['test', 'it']);
const MODIFIERS = new Set(['only', 'skip', 'fixme', 'fail']);
const HOOKS = new Set(['beforeEach', 'afterEach', 'beforeAll', 'afterAll']);

const isFunction = (node) => !!node && (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration');

// The name of a property access: `a.b` and `a['b']` are both 'b'.
const propertyName = (member) => {
    if (!member || member.type !== 'MemberExpression') return undefined;
    if (!member.computed) return member.property.type === 'Identifier' ? member.property.name : undefined;
    return member.property.type === 'Literal' && typeof member.property.value === 'string' ? member.property.value : undefined;
};

// The name of an object's key: `{ a: 1 }`, `{ 'a': 1 }` and the pattern `{ a }` are all 'a'.
const keyName = (property) => {
    if (!property || property.type !== 'Property' || property.computed) return undefined;
    if (property.key.type === 'Identifier') return property.key.name;
    return property.key.type === 'Literal' ? String(property.key.value) : undefined;
};

// 'test' for test(...) and test.only(...), 'hook' for test.beforeEach(...), 'describe' for
// test.describe(...) and its variants, 'step' for test.step(...); undefined for anything else.
const kindOfCall = (call) => {
    if (!call || call.type !== 'CallExpression') return undefined;
    const { callee } = call;
    if (callee.type === 'Identifier') return TEST_NAMES.has(callee.name) ? 'test' : undefined;
    if (callee.type !== 'MemberExpression') return undefined;
    const name = propertyName(callee);
    const { object } = callee;
    if (object.type === 'Identifier' && TEST_NAMES.has(object.name)) {
        if (MODIFIERS.has(name)) return 'test';
        if (HOOKS.has(name)) return 'hook';
        if (name === 'describe') return 'describe';
        if (name === 'step') return 'step';
        return undefined;
    }
    // test.describe.only(...), test.describe.serial(...), test.describe.serial.only(...)
    let inner = object;
    while (inner.type === 'MemberExpression' && propertyName(inner) !== 'describe') inner = inner.object;
    if (inner.type === 'MemberExpression' && inner.object.type === 'Identifier' && TEST_NAMES.has(inner.object.name)) {
        return name === 'configure' ? undefined : 'describe';
    }
    return undefined;
};

// The function a test(), hook or describe() call runs: its last argument.
const callbackOf = (call) => {
    const last = call.arguments[call.arguments.length - 1];
    return isFunction(last) ? last : undefined;
};

// 'test', 'hook', 'describe' or 'step' when `fn` is the callback of such a call.
const kindOfCallback = (fn) => {
    const { parent } = fn;
    return parent && parent.type === 'CallExpression' && callbackOf(parent) === fn ? kindOfCall(parent) : undefined;
};

const nearestFunction = (node) => {
    let current = node.parent;
    while (current && !isFunction(current)) current = current.parent;
    return current || undefined;
};

// expect(x), expect.soft(x) and expect.poll(fn): where an expectation starts.
const isExpectStart = (node) => {
    if (!node || node.type !== 'CallExpression') return false;
    const { callee } = node;
    if (callee.type === 'Identifier') return callee.name === 'expect';
    return callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'expect'
        && ['soft', 'poll'].includes(propertyName(callee));
};

// A call of one of the suite's own asserting helpers: expectShape(...), shell.expectEmptyTable(...).
const isHelperAssertion = (node) => {
    if (!node || node.type !== 'CallExpression') return false;
    const { callee } = node;
    const name = callee.type === 'Identifier' ? callee.name : propertyName(callee);
    return ASSERTION_HELPERS.includes(name);
};

const isAssertion = (node) => isExpectStart(node) || isHelperAssertion(node);

module.exports = {
    ASSERTION_HELPERS, callbackOf, isAssertion, isExpectStart, isFunction, keyName, kindOfCall, kindOfCallback, nearestFunction, propertyName
};

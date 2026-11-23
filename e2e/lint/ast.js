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

// Whether `parameter` of the function `fn` is the information about the running test or step:
// `(fixtures, testInfo)` of a test or hook, `(step)` of a step.
function isInfoParameter(fn, parameter) {
    const kind = kindOfCallback(fn);
    const index = fn.params.indexOf(parameter);
    return (['test', 'hook'].includes(kind) && index === 1) || (kind === 'step' && index === 0);
}

const nearestFunction = (node) => {
    let current = node.parent;
    while (current && !isFunction(current)) current = current.parent;
    return current || undefined;
};

// The variable an identifier stands for, from the scopes around it.
const variableOf = (sourceCode, identifier) => {
    for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
        const variable = scope.set.get(identifier.name);
        if (variable) return variable;
    }
    return undefined;
};

// `x as T`, `x!`, `(await x)` and `x?.y` say nothing new about what `x` is.
const WRAPPERS = new Set(['TSNonNullExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion', 'ChainExpression', 'AwaitExpression']);

const unwrap = (node) => {
    let current = node;
    while (current && WRAPPERS.has(current.type)) current = current.type === 'AwaitExpression' ? current.argument : current.expression;
    return current;
};

// The identifier an expression starts with: `test` for `test.describe.configure` and
// `test.info().project`, `testInfo` for `testInfo.project.name`.
const rootOf = (node) => {
    let current = unwrap(node);
    while (current && (current.type === 'MemberExpression' || current.type === 'CallExpression')) {
        current = unwrap(current.type === 'MemberExpression' ? current.object : current.callee);
    }
    return current && current.type === 'Identifier' ? current : undefined;
};

const TEST_OBJECTS = new Set(['test', 'it', 'testInfo']);

// Whether an expression is Playwright's `test`, something of it (`test.describe`, `test.info()`)
// or the information about the running test or step, under whatever name the file gave it:
// `import { test as base }`, `const it = test`, the second parameter of a test or hook and the
// parameter of a step. A `skip`, `only` or `retries` of anything else is not Playwright's.
const comesFromTest = (node, sourceCode, seen = new Set()) => {
    const root = rootOf(node);
    if (!root) return false;
    if (TEST_OBJECTS.has(root.name)) return true;
    const variable = variableOf(sourceCode, root);
    if (!variable || seen.has(variable)) return false;
    seen.add(variable);
    return variable.defs.some((def) => {
        if (def.type === 'ImportBinding') return def.node.type === 'ImportSpecifier' && def.node.imported.name === 'test';
        if (def.type === 'Variable') return def.node.id.type === 'Identifier' && !!def.node.init && comesFromTest(def.node.init, sourceCode, seen);
        if (def.type === 'Parameter') return isInfoParameter(def.node, def.name);
        return false;
    });
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
    ASSERTION_HELPERS,
    callbackOf,
    comesFromTest,
    isAssertion,
    isExpectStart,
    isFunction,
    isInfoParameter,
    keyName,
    kindOfCall,
    kindOfCallback,
    nearestFunction,
    propertyName,
    rootOf,
    unwrap,
    variableOf,
    WRAPPERS
};

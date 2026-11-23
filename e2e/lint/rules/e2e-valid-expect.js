// An expect() that can't fail: one without a matcher, one about a constant, one whose
// asynchronous matcher isn't awaited (the test ends before it has an answer), and one whose
// failure is caught.
const { isExpectStart, propertyName } = require('../ast.js');

// Matchers that wait for the page and return a promise.
const ASYNC_MATCHERS = new Set([
    'toBeAttached', 'toBeChecked', 'toBeDisabled', 'toBeEditable', 'toBeEmpty', 'toBeEnabled', 'toBeFocused', 'toBeHidden',
    'toBeInViewport', 'toBeOK', 'toBeVisible', 'toContainClass', 'toContainText', 'toHaveAccessibleDescription',
    'toHaveAccessibleErrorMessage', 'toHaveAccessibleName', 'toHaveAttribute', 'toHaveClass', 'toHaveCount', 'toHaveCSS',
    'toHaveId', 'toHaveJSProperty', 'toHaveRole', 'toHaveScreenshot', 'toHaveText', 'toHaveTitle', 'toHaveURL',
    'toHaveValue', 'toHaveValues', 'toMatchAriaSnapshot', 'toPass'
]);

const isConstant = (node) => !node
    || (node.type === 'Literal' && !node.regex)
    || (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    || (node.type === 'Identifier' && node.name === 'undefined');

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'an expect() has a matcher, a subject that can vary, is awaited when it waits, and is not caught' },
        schema: [],
        messages: {
            noMatcher: 'This expect() has no matcher, so it checks nothing: add `.toBe…()`, `.toHave…()` or `.toEqual(…)`.',
            constant: 'This expectation is about a constant, so it can\'t fail. Expect something the page or the API mock produced.',
            floating: '`{{matcher}}` waits for the page and returns a promise: without `await` the test ends before it has an answer, and a failure is lost.',
            caught: 'A `.catch()` on an expectation throws its failure away. Let it fail the test.'
        }
    },
    create: (context) => ({
        CallExpression(node) {
            if (!isExpectStart(node)) return;
            const poll = propertyName(node.callee) === 'poll';

            // Up the chain: expect(x).not.toBeVisible().catch(…)
            const names = [];
            let calls = 0;
            let top = node;
            for (;;) {
                const { parent } = top;
                if (parent.type === 'MemberExpression' && parent.object === top) names.push(propertyName(parent));
                else if (parent.type === 'CallExpression' && parent.callee === top) calls++;
                else break;
                top = parent;
            }

            if (calls === 0) {
                context.report({ node, messageId: 'noMatcher' });
                return;
            }
            if (!poll && isConstant(node.arguments[0])) context.report({ node, messageId: 'constant' });
            if (names.includes('catch')) {
                context.report({ node, messageId: 'caught' });
                return;
            }
            const matcher = names.find((name) => ASYNC_MATCHERS.has(name)) ?? (poll ? 'expect.poll()' : names.find((name) => name === 'resolves' || name === 'rejects'));
            if (matcher && top.parent.type === 'ExpressionStatement') context.report({ node, messageId: 'floating', data: { matcher } });
        }
    })
};

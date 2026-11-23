// Every test of the mocked-API suite runs inside the harness of ui/support/test.ts: the API mock
// answers and records every request, the browser is logged in, and a page error, a request
// nobody mocked and a handler nobody used fail the test. A spec may not step outside of it:
// by taking Playwright's own `test`, by sending requests from the test process (they go around
// the mock, to the suite's static server), or by replacing the fixtures that do the checking.
const { comesFromTest, isFunction, keyName, kindOfCallback, propertyName, unwrap } = require('../ast.js');

const PLAYWRIGHT = /^(@playwright\/test|playwright|playwright-core)$/;
const HARNESS = /(^|\/)support\/test\.ts$/;

// Fixtures that send requests from the test process, or hand out what does.
const OUTSIDE_FIXTURES = new Set(['request', 'playwright']);

// What ui/support/test.ts (and the coverage fixtures it includes) set up for every test. The
// options a spec may set are not here: session, tokens, area, allowedConsoleErrors, now, and
// strictApi, which has a rule of its own (e2e-no-weakened-checks).
const HARNESS_FIXTURES = new Set([
    'api', 'pageErrors', 'consoleErrors', 'storageState', 'frontend', 'layout',
    'coverage', 'routeVisits', 'coverageStore', 'routeVisitStore',
    'page', 'context', 'browser', 'baseURL'
]);

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'a spec of the mocked-API suite stays inside the harness: its test, its mock and its fixtures' },
        schema: [],
        messages: {
            playwrightImport: 'Import `test` and `expect` from ui/support/test.ts. The `test` of {{source}} has no API mock, no session and none of the checks every test of the suite gets. Types are fine: `import type { Page } from \'@playwright/test\'`.',
            otherTest: 'The `test` of a spec comes from ui/support/test.ts, not from {{source}}: only that one is known to have the API mock, the session and the checks.',
            request: '`{{name}}` sends requests from the test process, around the API mock: the suite\'s static server answers them and nothing is recorded or checked. Let the page ask (a click, `page.goto()`, or `page.evaluate(() => fetch(…))`) and read what it sent with `api.callsTo(…)`.',
            requestFixture: 'The `{{name}}` fixture sends requests from the test process, around the API mock: the suite\'s static server answers them and nothing is recorded or checked. Let the page ask (a click, `page.goto()`, or `page.evaluate(() => fetch(…))`) and read what it sent with `api.callsTo(…)`.',
            extend: 'A spec doesn\'t make a `test` of its own: `{{name}}` can replace the API mock, the session and the checks every test gets. Set options with `test.use({ session: \'board\' })`; a fixture that several specs need goes into ui/support/test.ts, a helper into ui/support/.',
            override: '`test.use({ {{name}}: … })` replaces a fixture of the harness, and with it the API mock or a check every test gets. Set the options instead (session, tokens, area, allowedConsoleErrors, now); change the logged-in member through the `me` and `myPermissions` fixtures.'
        }
    },
    create(context) {
        const { sourceCode } = context;

        const checkSource = (node, source, names) => {
            if (typeof source !== 'string') return;
            if (PLAYWRIGHT.test(source)) context.report({ node, messageId: 'playwrightImport', data: { source } });
            else if (names.includes('test') && !HARNESS.test(source)) context.report({ node, messageId: 'otherTest', data: { source } });
        };

        return {
            // import { test } from '@playwright/test'; import { test } from './my-own-test.ts'
            ImportDeclaration(node) {
                if (node.importKind === 'type') return;
                const values = node.specifiers.filter((specifier) => specifier.importKind !== 'type');
                // `import type` only, or `import {} from` for its side effects.
                if (node.specifiers.length > 0 && values.length === 0) return;
                checkSource(node, node.source.value, values.map((specifier) => (specifier.type === 'ImportSpecifier' ? specifier.imported.name : '*')));
            },
            // await import('@playwright/test')
            ImportExpression(node) {
                checkSource(node, node.source.value, []);
            },
            CallExpression(node) {
                const { callee } = node;
                // require('@playwright/test')
                if (callee.type === 'Identifier' && callee.name === 'require' && node.arguments[0]?.type === 'Literal') checkSource(node, node.arguments[0].value, []);
                // mergeTests(test, other)
                if (callee.type === 'Identifier' && callee.name === 'mergeTests') context.report({ node: callee, messageId: 'extend', data: { name: 'mergeTests()' } });
                if (callee.type !== 'MemberExpression' || !comesFromTest(callee.object, sourceCode)) return;
                // test.extend({ api: … }), base.extend<Fixtures>({ … })
                if (propertyName(callee) === 'extend') context.report({ node: callee.property, messageId: 'extend', data: { name: 'test.extend()' } });
                // test.use({ api: …, pageErrors: … })
                if (propertyName(callee) !== 'use') return;
                const options = unwrap(node.arguments[0]);
                for (const property of options && options.type === 'ObjectExpression' ? options.properties : []) {
                    const name = keyName(property);
                    if (HARNESS_FIXTURES.has(name)) context.report({ node: property, messageId: 'override', data: { name } });
                }
            },
            // page.request.get(…), context.request, page.context().request: an APIRequestContext.
            // `route.request()` and `response.request()` are calls, and give the page's own request.
            MemberExpression(node) {
                if (propertyName(node) !== 'request') return;
                if (node.parent.type === 'CallExpression' && node.parent.callee === node) return;
                context.report({ node, messageId: 'request', data: { name: sourceCode.getText(node) } });
            },
            // test('…', async ({ request }) => …), test.beforeEach(async ({ playwright }) => …)
            'ObjectPattern > Property': (node) => {
                const name = keyName(node);
                if (!OUTSIDE_FIXTURES.has(name)) return;
                const pattern = node.parent;
                const fn = pattern.parent;
                if (isFunction(fn) && fn.params[0] === pattern && ['test', 'hook'].includes(kindOfCallback(fn))) {
                    context.report({ node, messageId: 'requestFixture', data: { name } });
                }
            }
        };
    }
};

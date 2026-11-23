// ESLint for e2e/: the scripts, both Playwright suites and their support code.
//
// The rules whose names start with `e2e-` are the suite's own, in lint/rules/ (loaded with
// `--rulesdir lint/rules`, see the `lint` script). lint/rules.test.js checks every rule of
// this file that guards the tests against the fixtures in lint/fixtures/.

const FIND_BY_ROLE = 'Find elements by role, label or text (getByRole, getByLabel, getByText). If that can\'t find it, fix the markup.';

// What a file of the mocked-API suite may not do. Its specs must also pass on a phone and
// survive a rewrite of the pages they test, so they may only rely on what a user sees.
// docs/testing/writing-ui-specs.md
const UI_SYNTAX = [
    { selector: 'CallExpression[callee.property.name=\'locator\']', message: 'Find elements by role, label or text (getByRole, getByLabel, getByText), not with locator(). If that can\'t find it, fix the markup.' },
    { selector: 'CallExpression[callee.property.name=/^(getByTestId|getByPlaceholder|getByAltText|\\$|\\$\\$)$/]', message: FIND_BY_ROLE },
    { selector: 'CallExpression[callee.property.name=\'waitForTimeout\']', message: 'Wait for what the user would see, not for a fixed time.' },
    { selector: 'MemberExpression[property.name=/^(__vue__|\\$store|\\$root|\\$children)$/]', message: 'Don\'t read the app\'s internals: a spec may only rely on what a user sees.' },
    { selector: 'CallExpression[callee.property.name=\'getByRole\'][arguments.0.value=\'navigation\'] Property[key.name=\'name\'][value.value=\'Main menu\']', message: 'The sidebar is closed on a phone: get it with openMenu(page, layout) from ui/support/shell.ts.' },
    { selector: 'CallExpression[callee.property.name=\'getByRole\'][arguments.0.value=\'columnheader\']', message: 'Column headers are hidden on a phone: use tableRows(), cellOf() and sortBy() from ui/support/shell.ts.' },
    { selector: 'CallExpression[callee.property.name=/^(newContext|launch|launchPersistentContext)$/], CallExpression[callee.object.name=\'browser\'][callee.property.name=\'newPage\']', message: 'A browser or context of your own has no API mock, no session and none of the suite\'s checks. Use the test\'s `page`, or `context.newPage()` for a second one.' },
    { selector: 'MemberExpression[property.name=\'clock\']', message: 'Set the time with freezeTime(page) from ui/support/shell.ts, so every spec agrees on what now is.' },
    { selector: 'ObjectExpression:has(Property[key.name=\'tag\'] Literal[value=\'@desktop-only\']):not(:has(Property[key.name=\'annotation\'] ObjectExpression:has(Property[key.name=\'type\'][value.value=\'desktop-only\']):has(Property[key.name=\'description\'][value.value=/\\S/])))', message: 'A @desktop-only test says why it can\'t run on a phone: annotation: { type: \'desktop-only\', description: \'<reason>\' }.' }
];

// Which tags a test may carry: the behavioural specs only the ones that pick a project, the
// generated tests (one per route) only the one their run is selected by.
const BEHAVIOURAL_TAGS = { selector: 'Property[key.name=\'tag\'] Literal:not([value=/^@(desktop-only|phone-only)$/])', message: 'Tags are for the projects only: @desktop-only (with a reason) and @phone-only.' };
const GENERATED_TAGS = { selector: 'Property[key.name=\'tag\'] Literal:not([value=/^@(smoke|a11y)$/])', message: 'The generated tests carry the tag of their run only: @smoke or @a11y.' };

// A test that checks nothing must not be green. Each rule says what to do instead; they are
// described in docs/testing/writing-ui-specs.md.
const TESTS_CHECK_SOMETHING = {
    'e2e-expect-expect': 'error',
    'e2e-valid-expect': 'error',
    'e2e-no-conditional-expect': 'error',
    'e2e-no-early-return': 'error',
    'e2e-no-skipped-tests': 'error',
    'e2e-no-run-overrides': 'error'
};

module.exports = {
    root: true,
    env: {
        node: true,
        es2023: true
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module'
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended'
    ],
    rules: {
        'no-underscore-dangle': 'off',
        'no-param-reassign': ['error', { props: false }],
        'no-restricted-syntax': 'off',
        'no-plusplus': 'off',
        'comma-dangle': 'off',
        'max-len': 'off',
        'prefer-template': 'off',
        'guard-for-in': 'off',
        indent: ['error', 4],
        'prefer-destructuring': 'off',
        'arrow-body-style': 'off',
        'object-curly-newline': 'off',
        'no-await-in-loop': 'off',
        'no-continue': 'off',
        'consistent-return': 'off',
        'implicit-arrow-linebreak': 'off',
        'no-console': 'off',
        'lines-between-class-members': 'off',
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
        // tsc checks imports and requires explicit .ts extensions, which these rules don't understand.
        'import/extensions': 'off',
        'import/no-unresolved': 'off',
        'import/prefer-default-export': 'off',
        // Replaced by their TypeScript-aware versions.
        'no-unused-vars': 'off',
        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': 'error',
        'no-use-before-define': 'off',
        'no-empty-function': 'off'
    },
    overrides: [
        {
            // The mocked-API suite: its specs and what they share.
            files: ['ui/**/*.ts'],
            plugins: ['@eslint-community/eslint-comments'],
            rules: {
                // An exception needs its reason: // eslint-disable-next-line <rule> -- <reason>
                '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
                'no-restricted-syntax': ['error', ...UI_SYNTAX, BEHAVIOURAL_TAGS],
                // In the helpers too: a skip in a helper skips every test that calls it.
                'e2e-no-skipped-tests': 'error'
            }
        },
        {
            files: ['ui/smoke/**/*.ts', 'ui/a11y/**/*.ts'],
            rules: {
                'no-restricted-syntax': ['error', ...UI_SYNTAX, GENERATED_TAGS]
            }
        },
        {
            files: ['ui/**/*.spec.ts'],
            rules: {
                ...TESTS_CHECK_SOMETHING,
                // What differs between the viewports is in ui/support/shell.ts, not in a spec.
                'e2e-no-layout-branch': 'error',
                'e2e-no-weakened-checks': 'error'
            }
        },
        {
            // The generated tests use generic answers, so they can't list every request.
            files: ['ui/smoke/**/*.spec.ts', 'ui/a11y/**/*.spec.ts'],
            rules: {
                'e2e-no-weakened-checks': ['error', { allowStrictApiOff: true }]
            }
        },
        {
            // The real-stack suite.
            files: ['tests/**/*.spec.ts'],
            plugins: ['@eslint-community/eslint-comments'],
            rules: {
                '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
                ...TESTS_CHECK_SOMETHING
            }
        },
        {
            // A promise nobody waits for: `page.goto(…)`, `button.click()` or an `expect(locator)`
            // without `await` lets the test go on, or end, before the page has done anything.
            // The rule needs the types, so these files are linted with the TypeScript project.
            files: ['ui/**/*.ts', 'tests/**/*.ts', 'support/**/*.ts'],
            parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
            rules: {
                '@typescript-eslint/no-floating-promises': 'error'
            }
        },
        {
            // The lint rules themselves and their tests: CommonJS, as ESLint loads them with require().
            files: ['lint/**/*.js'],
            parserOptions: { sourceType: 'script' },
            rules: {
                '@typescript-eslint/no-require-imports': 'off',
                'global-require': 'off',
                strict: 'off',
                // lint/package.json only says that the folder is CommonJS; the packages are e2e's.
                'import/no-extraneous-dependencies': ['error', { devDependencies: true, packageDir: __dirname }]
            }
        }
    ]
};

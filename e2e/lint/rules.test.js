// Checks the lint rules that guard the tests (the suite's own `e2e-*` rules in lint/rules/, and
// the `no-restricted-syntax` list of .eslintrc.cjs) against the files in lint/fixtures/.
//
// Each fixture is linted with the real configuration, as the file its first line names
// (`// lint-as: ui/events/example.spec.ts`). A line the rules must report has
// `// expect-lint: <rule>[, <rule>]` above it; every other line must stay clean. So a rule
// that stops firing, a rule that is switched off for a folder, and a rule that starts to refuse
// what the suite does on purpose all fail here. See lint/fixtures/README.md.
//
// Usage: node --test lint/rules.test.js   (part of `npm run lint`)
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

// With CI=true typescript-eslint assumes one run over the files on disk and reads a file of the
// TypeScript project from there, whatever text it is given. The fixture with types stands in
// for a file that exists, so its own text would never be linted, and its test would fail in CI
// only. Decided here, before the parser is used, and for this process only: the last test of
// this file lints a file on disk the way CI does.
process.env.TSESTREE_SINGLE_RUN = 'false';

const { ESLint } = require('eslint');

const e2e = path.resolve(__dirname, '..');
const fixturesDir = path.join(__dirname, 'fixtures');
const rulesDir = path.join(__dirname, 'rules');

// The rules that guard the tests. What other rules say about a fixture (unused variables,
// style) is not what the fixtures are about.
const GUARDS = /^(e2e-|no-restricted-syntax$|@eslint-community\/eslint-comments\/require-description$|@typescript-eslint\/no-floating-promises$)/;
const TYPED = '@typescript-eslint/no-floating-promises';

// The one rule that needs the types can only look at a file of the TypeScript project. The
// fixtures stand in for files that don't exist, so they are linted without it; a fixture that
// says `// lint-with-types` stands in for a file that does exist and gets every rule.
const untyped = new ESLint({
    cwd: e2e,
    rulePaths: [rulesDir],
    ignore: false,
    overrideConfig: { parserOptions: { project: null }, rules: { [TYPED]: 'off' } }
});
const typed = new ESLint({ cwd: e2e, rulePaths: [rulesDir], ignore: false });

const ownRules = fs.readdirSync(rulesDir).filter((file) => file.endsWith('.js')).map((file) => file.slice(0, -3)).sort();
const fixtures = fs.readdirSync(fixturesDir).filter((file) => file.endsWith('.ts')).sort();

// Line -> the rules expected to report it, from the `expect-lint` comments.
const expectedIn = (source) => {
    const expected = {};
    source.split('\n').forEach((line, index) => {
        const marker = line.match(/^\s*\/\/ expect-lint: (.+)$/);
        if (marker) expected[index + 2] = marker[1].split(',').map((rule) => rule.trim()).sort();
    });
    return expected;
};

const lint = async (file) => {
    const source = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
    const lintAs = source.match(/^\/\/ lint-as: (\S+)\n/);
    assert.ok(lintAs, `${file} starts with \`// lint-as: <path under e2e/>\``);
    const withTypes = /^\/\/ lint-with-types$/m.test(source);
    if (withTypes) assert.ok(fs.existsSync(path.join(e2e, lintAs[1])), `${lintAs[1]} exists: a fixture with types stands in for a real file`);
    const [result] = await (withTypes ? typed : untyped).lintText(source, { filePath: path.join(e2e, lintAs[1]) });
    return { source, lintAs: lintAs[1], messages: result.messages };
};

describe('the lint rules that guard the tests', () => {
    const reported = new Set();

    for (const file of fixtures) {
        it(`${file}: reports the marked lines and no others`, async () => {
            const { source, messages } = await lint(file);
            const fatal = messages.filter((message) => message.fatal).map((message) => `${message.line}: ${message.message}`);
            assert.deepEqual(fatal, [], 'the fixture can be parsed');

            const actual = {};
            for (const message of messages.filter((item) => GUARDS.test(item.ruleId ?? ''))) {
                actual[message.line] = [...(actual[message.line] ?? []), message.ruleId].sort();
                reported.add(message.ruleId);
            }
            const expected = expectedIn(source);
            assert.ok(Object.keys(expected).length > 0, 'the fixture marks at least one line');
            assert.deepEqual(actual, expected);
        });
    }

    // The fixture above is linted from its text. `npm run lint` in CI is the other way: one run
    // over the files on disk (CI=true). A real file with the same mistakes, linted by the
    // command of the `lint` script in that mode, has to be reported too.
    it('a promise nobody waits for is also reported in a file on disk, linted as CI does', () => {
        // Not named .spec.ts: a Playwright run that starts meanwhile must not pick it up.
        const probe = path.join(e2e, `ui/harness/lint-probe-${process.pid}.ts`);
        const source = fs.readFileSync(path.join(fixturesDir, 'no-floating-promises.ts'), 'utf8');
        const env = { ...process.env, CI: 'true' };
        delete env.TSESTREE_SINGLE_RUN;
        let results;
        fs.writeFileSync(probe, source);
        try {
            const eslint = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin/eslint.js');
            const output = execFileSync(process.execPath, [eslint, '--rulesdir', rulesDir, '--format', 'json', '--no-ignore', probe], {
                cwd: e2e,
                env,
                encoding: 'utf8',
                // ESLint exits 1 when it reports something, which is what this is about.
                stdio: ['ignore', 'pipe', 'inherit']
            });
            results = JSON.parse(output);
        } catch (error) {
            assert.equal(error.status, 1, `eslint ran: ${error.message}`);
            results = JSON.parse(error.stdout);
        } finally {
            fs.rmSync(probe, { force: true });
        }
        const lines = (rules) => Object.keys(rules).map(Number).sort((a, b) => a - b);
        const expected = Object.fromEntries(Object.entries(expectedIn(source)).filter(([, rules]) => rules.includes(TYPED)));
        assert.ok(lines(expected).length > 0, 'the fixture marks a line for the rule');
        assert.deepEqual(results[0].messages.filter((item) => item.ruleId === TYPED).map((item) => item.line), lines(expected));
    });

    it('every rule of lint/rules/ is proven by a fixture', () => {
        assert.ok(ownRules.length > 0);
        assert.deepEqual([...ownRules, TYPED].filter((rule) => !reported.has(rule)), []);
    });

    it('every rule of lint/rules/ is on for the specs of the mocked-API suite', async () => {
        const config = await typed.calculateConfigForFile(path.join(e2e, 'ui/events/example.spec.ts'));
        const off = [...ownRules, TYPED].filter((rule) => !['error', 2].includes([config.rules[rule]].flat()[0]));
        assert.deepEqual(off, []);
    });

    it('a spec in any folder of ui/ gets the same rules, apart from the generated tests\' own', async () => {
        const rulesFor = async (file) => {
            const { rules } = await typed.calculateConfigForFile(path.join(e2e, file));
            return Object.fromEntries(Object.entries(rules).filter(([rule]) => GUARDS.test(rule)));
        };
        const behavioural = await rulesFor('ui/events/example.spec.ts');
        for (const file of ['ui/shell/example.spec.ts', 'ui/harness/example.spec.ts', 'ui/core/deeper/example.spec.ts']) {
            assert.deepEqual(await rulesFor(file), behavioural, file);
        }
        // The generated tests differ in two things only: the tag they carry, and the strict mode.
        for (const file of ['ui/smoke/routes.spec.ts', 'ui/a11y/pages.spec.ts']) {
            const generated = await rulesFor(file);
            const different = Object.keys(behavioural).filter((rule) => JSON.stringify(generated[rule]) !== JSON.stringify(behavioural[rule])).sort();
            assert.deepEqual(different, ['e2e-no-weakened-checks', 'no-restricted-syntax'], file);
            assert.deepEqual(generated['e2e-no-weakened-checks'], ['error', { allowStrictApiOff: true }], file);
        }
    });
});

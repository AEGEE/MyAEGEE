// What counts as weakening the coverage gate, what accepts it, and which reasons are refused.
// Run: node --test scripts/   (part of `npm run lint`)
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AREA_CONFIG_PATH, compareWithBase, resolveBase, type ConfigCheck, type Git, type Tree } from './coverage-gate.ts';
import { reasonProblem } from './reason.ts';

type Files = Record<string, string>;

const tree = (files: Files): Tree => ({
    read: (file) => files[file],
    list: (directory) => Object.keys(files).filter((file) => file.startsWith(`${directory}/`)).map((file) => file.slice(directory.length + 1))
});

interface Exception { file: string; condition: string; reason: string }

const area = (name: string, gate: 'pending' | 'enforced', templateExceptions: Exception[] = []): Files => ({
    [`${AREA_CONFIG_PATH}/${name}.json`]: JSON.stringify({ gate, templateExceptions }, null, 2)
});
const thresholds = (scriptLines = 90, scriptBranches = 85, templateBranches = 85): Files => ({
    [`${AREA_CONFIG_PATH}/thresholds.json`]: JSON.stringify({ scriptLines, scriptBranches, templateBranches })
});
const accepted = (...entries: object[]): Files => ({ [`${AREA_CONFIG_PATH}/downgrades.json`]: JSON.stringify(entries) });
const source = (file: string, comments: number): Files => ({
    [file]: `export default {}\n${'/* istanbul ignore next -- the browser of the tests has no WebGL */\n'.repeat(comments)}`
});

const REASON = 'the status page moves to another service next month';
const CANCELLED: Exception = { file: 'views/events/Single.vue', condition: '_vm.event.status === \'cancelled\'', reason: 'events have no such status in the API' };
const SINGLE = 'frontend/src/views/events/Single.vue';

const compare = (base: Files, head: Files): ConfigCheck => {
    const ignoreFiles = Object.keys(head).filter((file) => file.startsWith('frontend/src/'));
    return compareWithBase(tree(head), tree(base), ignoreFiles);
};

describe('the gate against its base', () => {
    test('nothing changed: nothing to say', () => {
        const files = { ...area('events', 'enforced', [CANCELLED]), ...area('core', 'pending'), ...thresholds(), ...source(SINGLE, 1) };
        assert.deepEqual(compare(files, files), { lines: [], problems: [] });
    });

    test('a first version of the gate has no base to be weaker than', () => {
        const head = { ...area('events', 'enforced', [CANCELLED]), ...thresholds(), ...source(SINGLE, 1) };
        const { lines, problems } = compare({}, head);
        assert.deepEqual(problems, []);
        assert.deepEqual(lines, [
            'COVERAGE-EXCEPTION-ADDED: template exception in events: `_vm.event.status === \'cancelled\'` in views/events/Single.vue',
            `COVERAGE-EXCEPTION-ADDED: istanbul ignore comment in events: ${SINGLE} has 1, it had 0`
        ]);
    });

    test('an enforced area that goes back to pending fails', () => {
        const { lines, problems } = compare({ ...area('events', 'enforced') }, { ...area('events', 'pending') });
        assert.deepEqual(lines, ['COVERAGE-DOWNGRADE: the area events was enforced and is pending now. NOT ACCEPTED']);
        assert.equal(problems.length, 1);
        assert.match(problems[0], /Undo it, or accept it in e2e\/ui\/support\/coverage\/downgrades\.json with a reason: \{ "change": "pending", "area": "events", "reason": "…" \}/);
    });

    test('so does an enforced area that loses its file', () => {
        assert.deepEqual(compare({ ...area('events', 'enforced') }, {}).lines, ['COVERAGE-DOWNGRADE: the area events was enforced and is pending now. NOT ACCEPTED']);
    });

    test('an accepted downgrade passes, and is printed with its reason', () => {
        const { lines, problems } = compare(
            { ...area('events', 'enforced') },
            { ...area('events', 'pending'), ...accepted({ change: 'pending', area: 'events', reason: REASON }) }
        );
        assert.deepEqual(problems, []);
        assert.deepEqual(lines, [`COVERAGE-DOWNGRADE: the area events was enforced and is pending now. Accepted in downgrades.json: ${REASON}`]);
    });

    test('pending to enforced, and a pending area that stays pending, are fine', () => {
        const base = { ...area('events', 'pending'), ...area('core', 'pending') };
        assert.deepEqual(compare(base, { ...area('events', 'enforced'), ...area('core', 'pending') }), { lines: [], problems: [] });
    });

    test('a new template exception in an enforced area fails until it is accepted', () => {
        const base = { ...area('events', 'enforced') };
        const head = { ...area('events', 'enforced', [CANCELLED]) };
        const refused = compare(base, head);
        assert.deepEqual(refused.lines, ['COVERAGE-DOWNGRADE: new template exception in the enforced area events: `_vm.event.status === \'cancelled\'` in views/events/Single.vue. NOT ACCEPTED']);
        assert.equal(refused.problems.length, 1);

        const passed = compare(base, { ...head, ...accepted({ change: 'exception', file: CANCELLED.file, condition: CANCELLED.condition, reason: REASON }) });
        assert.deepEqual(passed.problems, []);
        assert.match(passed.lines[0], /^COVERAGE-DOWNGRADE: new template exception .* Accepted in downgrades\.json: /);
    });

    test('an exception that only changed its reason or its spacing is the same exception', () => {
        const reworded = { ...CANCELLED, condition: '_vm.event.status   ===\n \'cancelled\'', reason: 'the events service has no status with this name' };
        assert.deepEqual(compare({ ...area('events', 'enforced', [CANCELLED]) }, { ...area('events', 'enforced', [reworded]) }), { lines: [], problems: [] });
    });

    test('the exceptions an area gets while it becomes enforced are listed, not refused', () => {
        const { lines, problems } = compare({ ...area('events', 'pending') }, { ...area('events', 'enforced', [CANCELLED]) });
        assert.deepEqual(problems, []);
        assert.deepEqual(lines, ['COVERAGE-EXCEPTION-ADDED: template exception in events: `_vm.event.status === \'cancelled\'` in views/events/Single.vue']);
    });

    test('a lowered threshold fails until it is accepted; a raised one is fine', () => {
        const lowered = compare({ ...thresholds(90, 85, 85) }, { ...thresholds(90, 85, 80) });
        assert.deepEqual(lowered.lines, ['COVERAGE-DOWNGRADE: the threshold templateBranches is 80 %, it was 85 %. NOT ACCEPTED']);
        assert.equal(lowered.problems.length, 1);

        const passed = compare({ ...thresholds(90, 85, 85) }, { ...thresholds(90, 85, 80), ...accepted({ change: 'threshold', metric: 'templateBranches', reason: REASON }) });
        assert.deepEqual(passed.problems, []);

        assert.deepEqual(compare({ ...thresholds(90, 85, 85) }, { ...thresholds(95, 85, 85) }), { lines: [], problems: [] });
        assert.deepEqual(compare({ ...thresholds() }, {}).lines.length, 3);
    });

    test('a new ignore comment in a file of an enforced area fails until it is accepted', () => {
        const base = { ...area('events', 'enforced'), ...source(SINGLE, 1) };
        const head = { ...area('events', 'enforced'), ...source(SINGLE, 2) };
        const refused = compare(base, head);
        assert.deepEqual(refused.lines, [`COVERAGE-DOWNGRADE: ${SINGLE} (enforced area events) has 2 istanbul ignore comment(s), it had 1. NOT ACCEPTED`]);
        assert.equal(refused.problems.length, 1);

        assert.deepEqual(compare(base, { ...head, ...accepted({ change: 'ignore', file: SINGLE, reason: REASON }) }).problems, []);
        // One fewer, or as many as before, is no downgrade.
        assert.deepEqual(compare(head, base), { lines: [], problems: [] });
    });

    test('a file outside views/ belongs to the shell', () => {
        const navbar = 'frontend/src/components/layout/Navbar.vue';
        const enforced = compare({ ...area('shell', 'enforced') }, { ...area('shell', 'enforced'), ...source(navbar, 1) });
        assert.deepEqual(enforced.lines, [`COVERAGE-DOWNGRADE: ${navbar} (enforced area shell) has 1 istanbul ignore comment(s), it had 0. NOT ACCEPTED`]);

        const pending = compare({ ...area('shell', 'pending'), ...area('events', 'enforced') }, { ...area('shell', 'pending'), ...area('events', 'enforced'), ...source(navbar, 1) });
        assert.deepEqual(pending.problems, []);
        assert.deepEqual(pending.lines, [`COVERAGE-EXCEPTION-ADDED: istanbul ignore comment in shell: ${navbar} has 1, it had 0`]);
    });

    test('an entry that matches no downgrade of this change fails', () => {
        const files = { ...area('events', 'enforced') };
        const { problems } = compare(files, { ...files, ...accepted({ change: 'pending', area: 'events', reason: REASON }) });
        assert.deepEqual(problems, ['e2e/ui/support/coverage/downgrades.json: the entry for "pending events" matches no downgrade in this change: remove it']);
    });

    test('an entry that the base has too accepts nothing any more', () => {
        const entry = accepted({ change: 'pending', area: 'events', reason: REASON });
        // Left behind by the change that made events pending, which is merged: not an error.
        const leftover = compare({ ...area('events', 'pending'), ...entry }, { ...area('events', 'pending'), ...entry });
        assert.deepEqual(leftover.problems, []);
        assert.deepEqual(leftover.lines, ['e2e/ui/support/coverage/downgrades.json: the entry for "pending events" is from an earlier change and accepts nothing any more: remove it']);

        // The area was enforced again since. The old entry doesn't cover the next time.
        const again = compare({ ...area('events', 'enforced'), ...entry }, { ...area('events', 'pending'), ...entry });
        assert.equal(again.problems.length, 1);
        assert.match(again.lines[0], /^COVERAGE-DOWNGRADE: the area events was enforced and is pending now\. NOT ACCEPTED$/);
    });

    test('an entry needs its fields and a real reason', () => {
        const base = { ...area('events', 'enforced') };
        const head = { ...area('events', 'pending') };
        const problemsWith = (...entries: object[]): string[] => compare(base, { ...head, ...accepted(...entries) }).problems;

        assert.match(problemsWith({ change: 'pending', area: 'events', reason: 'todo' })[0], /entry 1: the reason is a placeholder \("todo"\)/);
        assert.match(problemsWith({ change: 'pending', area: 'events', reason: 'events' })[0], /entry 1: the reason needs at least 4 words and 20 characters/);
        assert.match(problemsWith({ change: 'pending', area: 'events' })[0], /entry 1: the reason is missing/);
        assert.match(problemsWith({ change: 'pending', reason: REASON })[0], /entry 1 \("pending"\) takes "area", "reason" and nothing else/);
        assert.match(problemsWith({ change: 'pending', area: 'events', metric: 'scriptLines', reason: REASON })[0], /takes "area", "reason" and nothing else/);
        assert.match(problemsWith({ change: 'enforced->pending', area: 'events', reason: REASON })[0], /entry 1 needs a "change": "pending", "exception", "ignore", "threshold"/);
        // An entry that is refused accepts nothing: the downgrade is a problem as well.
        assert.equal(problemsWith({ change: 'pending', area: 'events', reason: 'todo' }).length, 2);

        const broken = compare(base, { ...head, [`${AREA_CONFIG_PATH}/downgrades.json`]: '{ "change": ' });
        assert.match(broken.problems[0], /downgrades\.json is not valid JSON/);
        const noList = compare(base, { ...head, [`${AREA_CONFIG_PATH}/downgrades.json`]: '{}' });
        assert.match(noList.problems[0], /downgrades\.json has to be a list of accepted downgrades/);
    });
});

describe('the base of the comparison', () => {
    const git = (answers: Record<string, string>): Git => (args) => answers[args.join(' ')];
    const REPOSITORY = {
        'rev-parse --verify --quiet origin/stable^{commit}': 'aaa111\n',
        'rev-parse --verify --quiet HEAD~1^{commit}': 'bbb222\n',
        'rev-parse --verify --quiet v1.0^{commit}': 'ccc333\n',
        'merge-base HEAD origin/stable': 'ddd444\n'
    };

    test('a branch is compared with where it left stable, in CI and outside', () => {
        const expected = { ref: 'ddd444', from: 'the merge base with origin/stable' };
        assert.deepEqual(resolveBase(undefined, {}, git(REPOSITORY)), expected);
        assert.deepEqual(resolveBase(undefined, { CI: 'true', CIRCLE_BRANCH: 'test/frontend-harness' }, git(REPOSITORY)), expected);
        assert.deepEqual(resolveBase(undefined, { CI: 'true', GITHUB_REF_NAME: '2386/merge' }, git(REPOSITORY)), expected);
    });

    test('stable in CI is compared with the commit before', () => {
        const expected = { ref: 'bbb222', from: 'the commit before this one on stable' };
        assert.deepEqual(resolveBase(undefined, { CI: 'true', CIRCLE_BRANCH: 'stable' }, git(REPOSITORY)), expected);
        assert.deepEqual(resolveBase(undefined, { CI: 'true', GITHUB_REF_NAME: 'stable' }, git(REPOSITORY)), expected);
        // A local checkout of stable is compared with origin/stable, to see what isn't pushed yet.
        assert.deepEqual(resolveBase(undefined, { CIRCLE_BRANCH: 'stable' }, git(REPOSITORY)), { ref: 'ddd444', from: 'the merge base with origin/stable' });
    });

    test('a given commit wins', () => {
        assert.deepEqual(resolveBase('v1.0', { CI: 'true', CIRCLE_BRANCH: 'stable' }, git(REPOSITORY)), { ref: 'ccc333', from: '--base v1.0' });
        assert.deepEqual(resolveBase('nonsense', {}, git(REPOSITORY)), { problem: '--base nonsense is not a commit of this repository' });
    });

    test('without the history there is a problem to report, not a base', () => {
        assert.match((resolveBase(undefined, {}, git({})) as { problem: string }).problem, /^origin\/stable is not there/);
        assert.match((resolveBase(undefined, { CI: 'true', CIRCLE_BRANCH: 'stable' }, git({})) as { problem: string }).problem, /^HEAD~1 is not there/);
        const shallow = { 'rev-parse --verify --quiet origin/stable^{commit}': 'aaa111\n' };
        assert.match((resolveBase(undefined, {}, git(shallow)) as { problem: string }).problem, /^HEAD and origin\/stable have no common commit/);
    });
});

describe('reasons', () => {
    const CONDITION = '_vm.event.status === \'cancelled\'';

    test('a sentence that says why is accepted', () => {
        for (const reason of [
            'needs WebGL, which the CI browser lacks',
            'the API never sends an event without organisers',
            'events have no such status in the API',
            'the API cuts the list at 10000 rows',
            `${CONDITION} never happens: events have no such status`
        ]) assert.equal(reasonProblem(reason, { not: [CONDITION] }), undefined, reason);
    });

    test('one character, a word or two are not', () => {
        for (const reason of ['x', '-', '...', 'none', 'not needed', 'defensive', 'legacy code path', 'can not happen']) assert.match(reasonProblem(reason) ?? '', /needs at least 4 words and 20 characters/, reason);
    });

    test('placeholders are not, however long', () => {
        for (const reason of ['todo', 'TBD', 'n/a', 'xxx', 'temp', 'wip', 'fixme', 'TODO: write down why this one is fine', 'wip, the reason comes with the next change', 'N/A for this page of the app']) {
            assert.match(reasonProblem(reason) ?? '', /is a placeholder/, reason);
        }
        for (const reason of ['hard to test', 'this one is really hard to test in a browser', 'too difficult to reach from a test', 'see above', 'same as above, for the other button', 'no time for this before the release', 'will be tested later, with the rest']) {
            assert.match(reasonProblem(reason) ?? '', /is not a reason/, reason);
        }
    });

    test('filling the length with repetition is not', () => {
        assert.match(reasonProblem('aaaaaaaaaaaaaaaaaaaa bbbbbbbb cccccc dddddd') ?? '', /repeats one character/);
        assert.match(reasonProblem('because because because because because') ?? '', /needs at least 4 different words/);
        assert.match(reasonProblem('it is it is it is it is it is') ?? '', /needs at least 4 different words/);
    });

    test('the condition or the file name again is not', () => {
        assert.match(reasonProblem(CONDITION, { not: [CONDITION] }) ?? '', /needs at least 4 words and 20 characters of its own/);
        assert.match(reasonProblem(`${CONDITION} can not happen`, { not: [CONDITION] }) ?? '', /of its own/);
        assert.match(reasonProblem('views/events/Single.vue views/events/Single.vue is fine', { not: ['views/events/Single.vue'] }) ?? '', /of its own/);
    });
});

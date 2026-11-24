// Tests of the jest hook with stand-ins for jest's globals: node --test mailer/contract/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const valid = { to: 'member@example.org', subject: 'Subject', template: 'password_reset.html', parameters: { token: 'abc' } };
const invalid = { ...valid, parameters: {} };

const TEST_PATH = path.join(__dirname, '..', '..', 'network', 'test', 'unit', 'some.test.js');

// A jest.fn() stand-in: records its calls.
function jestMock() {
    const mock = async (...args) => { mock.mock.calls.push(args); return { success: true }; };
    mock.mock = { calls: [] };
    mock._isMockFunction = true; // eslint-disable-line no-underscore-dangle
    return mock;
}

// A fresh hook module and fake jest globals per test, as jest gives each test file.
function setUp() {
    const hooks = { before: [], after: [], afterAll: [] };
    global.beforeEach = (fn) => hooks.before.push(fn);
    global.afterEach = (fn) => hooks.after.push(fn);
    global.afterAll = (fn) => hooks.afterAll.push(fn);
    global.expect = { getState: () => ({ currentTestName: 'a test', testPath: TEST_PATH }) };
    delete require.cache[require.resolve('./jest-hook.cjs')];
    const hook = require('./jest-hook.cjs'); // eslint-disable-line global-require
    const sent = [];
    const mailer = { sendMail: async (options) => { sent.push(options); return { success: true }; } };
    const runTest = async (body) => {
        hooks.before.forEach((fn) => fn());
        await body();
        hooks.after.forEach((fn) => fn());
    };
    const endFile = () => hooks.afterAll.forEach((fn) => fn());
    return { hook, hooks, mailer, sent, runTest, endFile };
}

test('a mail that matches the contract is sent and the test passes', async () => {
    const { hook, mailer, sent, runTest } = setUp();
    hook.install(() => mailer, { service: 'core' });

    await runTest(async () => assert.deepEqual(await mailer.sendMail(valid), { success: true }));
    assert.deepEqual(sent, [valid]);
});

test('a mail that does not match is still sent, and the test fails afterwards with the problems', async () => {
    const { hook, mailer, sent, runTest } = setUp();
    hook.install(() => mailer, { service: 'core' });

    await assert.rejects(
        runTest(() => mailer.sendMail(invalid)),
        /core: 1 mail\(s\) in this test don't match mailer\/contract\/mail-templates.json:\n {2}password_reset: parameters.token: missing/
    );
    assert.deepEqual(sent, [invalid]);

    // The next test starts clean.
    await runTest(() => mailer.sendMail(valid));
});

test('the client is loaded for each test and wrapped once', async () => {
    const { hook, mailer, sent, runTest } = setUp();
    let loads = 0;
    hook.install(() => { loads += 1; return mailer; }, { service: 'core' });
    assert.equal(loads, 0);

    await runTest(() => mailer.sendMail(valid));
    await runTest(() => mailer.sendMail(valid));
    // Before each test to wrap it, after it to read a mocked client's calls.
    assert.equal(loads, 4);
    assert.equal(sent.length, 2);
});

test('a jest mock of the client is not wrapped, and the mails it received are checked after the test', async () => {
    const { hook, runTest, endFile } = setUp();
    const mock = jestMock();
    const mailer = { sendMail: mock };
    hook.install(() => mailer, { service: 'network' });

    await runTest(() => mailer.sendMail(valid));
    assert.equal(mailer.sendMail, mock);
    await assert.rejects(runTest(() => mailer.sendMail(invalid)), /network: 1 mail\(s\) in this test don't match/);
    endFile();
});

test('a spy that calls through to the wrapped client checks each mail once', async () => {
    const { hook, mailer, runTest, endFile } = setUp();
    const report = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mail-contract-')), 'report.jsonl');
    hook.install(() => mailer, { service: 'network', report });

    await runTest(async () => {
        const wrapped = mailer.sendMail;
        const spy = jestMock();
        mailer.sendMail = async (options) => { await spy(options); return wrapped(options); };
        Object.assign(mailer.sendMail, { mock: spy.mock, _isMockFunction: true });
        await mailer.sendMail(valid);
    });
    endFile();

    assert.deepEqual(JSON.parse(fs.readFileSync(report, 'utf8')), {
        service: 'network', file: 'network/test/unit/some.test.js', checked: 1, mocked: true, unchecked: null
    });
});

test('a test file that mocks the client and checks no mail fails at its end', async () => {
    const { hook, runTest, endFile } = setUp();
    const mailer = { sendMail: jestMock() };
    hook.install(() => mailer, { service: 'network' });

    await runTest(async () => {
        await mailer.sendMail(valid);
        mailer.sendMail.mock.calls = []; // cleared before the hook's afterEach
    });
    assert.throws(endFile, (err) => {
        assert.match(err.message, /^network: network\/test\/unit\/some.test.js mocks the mail client, and the mail contract hook checked no mail in it/);
        assert.match(err.message, /jest.spyOn\(mailer, 'sendMail'\) without replacing it/);
        assert.match(err.message, /allowUncheckedMails\('<reason>'\)/);
        return true;
    });
});

test('a test file that mocks the client and never sends a mail fails at its end', async () => {
    const { hook, runTest, endFile } = setUp();
    const mailer = { sendMail: jestMock() };
    hook.install(() => mailer, { service: 'network' });

    await runTest(async () => {});
    assert.throws(endFile, /checked no mail/);
});

test('allowUncheckedMails lets a test file mock the client without a checked mail, and is reported', async () => {
    const { hook, runTest, endFile } = setUp();
    const report = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mail-contract-')), 'report.jsonl');
    const mailer = { sendMail: jestMock() };
    hook.install(() => mailer, { service: 'network', report });

    assert.throws(() => hook.allowUncheckedMails(''), /needs the reason/);
    hook.allowUncheckedMails('tests only the branches that send nothing');
    await runTest(async () => {});
    endFile();

    assert.deepEqual(JSON.parse(fs.readFileSync(report, 'utf8')), {
        service: 'network', file: 'network/test/unit/some.test.js', checked: 0, mocked: true, unchecked: 'tests only the branches that send nothing'
    });
});

test('a test file whose real client sends nothing passes at its end', async () => {
    const { hook, runTest, endFile } = setUp();
    hook.install(() => ({ sendMail: async () => ({ success: true }) }), { service: 'core' });

    await runTest(async () => {});
    endFile();
});

test('allowViolations lets one test send an invalid mail', async () => {
    const { hook, mailer, runTest } = setUp();
    hook.install(() => mailer, { service: 'core' });

    await runTest(async () => {
        hook.allowViolations();
        await mailer.sendMail(invalid);
    });
    await assert.rejects(runTest(() => mailer.sendMail(invalid)), /don't match/);
});

test('a client without sendMail is an error', () => {
    const { hook, hooks } = setUp();
    hook.install(() => ({}), { service: 'core' });

    assert.throws(() => hooks.before[0](), /core: mail contract hook: the mail client has no sendMail function/);
});

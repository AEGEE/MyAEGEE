// Tests of the jest hook with stand-ins for jest's globals: node --test mailer/contract/

const test = require('node:test');
const assert = require('node:assert/strict');

const valid = { to: 'member@example.org', subject: 'Subject', template: 'password_reset.html', parameters: { token: 'abc' } };
const invalid = { ...valid, parameters: {} };

// A fresh hook module and fake jest globals per test, as jest gives each test file.
function setUp() {
    const hooks = { before: [], after: [] };
    global.beforeEach = (fn) => hooks.before.push(fn);
    global.afterEach = (fn) => hooks.after.push(fn);
    global.expect = { getState: () => ({ currentTestName: 'a test', testPath: '/x/some.test.js' }) };
    delete require.cache[require.resolve('./jest-hook.cjs')];
    const hook = require('./jest-hook.cjs'); // eslint-disable-line global-require
    const sent = [];
    const mailer = { sendMail: async (options) => { sent.push(options); return { success: true }; } };
    const runTest = async (body) => {
        hooks.before.forEach((fn) => fn());
        await body();
        hooks.after.forEach((fn) => fn());
    };
    return { hook, hooks, mailer, sent, runTest };
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

test('the client is loaded before each test and wrapped once', async () => {
    const { hook, mailer, sent, runTest } = setUp();
    let loads = 0;
    hook.install(() => { loads += 1; return mailer; }, { service: 'core' });
    assert.equal(loads, 0);

    await runTest(() => mailer.sendMail(valid));
    await runTest(() => mailer.sendMail(valid));
    assert.equal(loads, 2);
    assert.equal(sent.length, 2);
});

test('a jest mock of the client is left alone', async () => {
    const { hook, runTest } = setUp();
    const mock = Object.assign(async () => ({ success: true }), { _isMockFunction: true });
    const mailer = { sendMail: mock };
    hook.install(() => mailer, { service: 'network' });

    await runTest(() => mailer.sendMail(invalid));
    assert.equal(mailer.sendMail, mock);
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

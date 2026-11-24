// Checks every mail a service sends in its jest tests against the mail contract.
//
// A service's jest setup file (setupFilesAfterEnv) calls
//
//   install(() => require('../../lib/mailer'), { service: '<service>' });
//
// Before each test the hook wraps the module's sendMail: it checks the request, records what
// doesn't match the contract and then sends it as before. It does not throw, because a throw
// would come back as a confusing 500 from the route under test. Instead the test fails
// afterwards with one line per problem.
//
// The module is required in beforeEach, not when the setup file runs: by then the test file's
// jest.mock() calls are registered, so a test that mocks what the mail client uses (its http
// module, say) still gets a client that uses the mock. That is also why only calls through the
// module's export are seen: a `const { sendMail } = require('./mailer')` taken when the module
// loads keeps the unwrapped function. check-senders.cjs rejects that in the services' code.
//
// A test that mocks the mail client (jest.mock() of the module, or a jest.spyOn() that replaces
// sendMail) is not wrapped: after each test the hook checks the mails recorded in the mock's
// calls instead. At the end of a test file in which the client was mocked, if the hook checked
// no mail at all, the file fails: either the calls were cleared before the test ended, or the
// tests never send one through it. A file that has a reason not to check its mails says so
// with allowUncheckedMails('<reason>').
//
// MAIL_CONTRACT_REPORT=<file> appends one JSON line per test file: the service, the test file,
// how many mails the hook checked, whether the client was mocked, and the opt-out reason.
//
// MAIL_CONTRACT_CAPTURE=<dir> also writes the first three requests per template and test file
// to <dir>/<service>-<template>-<test file>-<n>.json, to fill the manifest's examples from real
// payloads.

const fs = require('node:fs');
const path = require('node:path');

const { checkMail } = require('./check-mail.cjs');

const HOOKED = Symbol.for('myaegee.mailContract.hooked');

// The state of the hook installed in this test file (one module instance per test file).
let active;

function testState() {
    try {
        // eslint-disable-next-line no-undef
        return expect.getState();
    } catch (err) {
        return {};
    }
}

function isJestMock(fn) {
    return Boolean(fn && fn._isMockFunction === true); // eslint-disable-line no-underscore-dangle
}

function install(getMailer, {
    service, capture = process.env.MAIL_CONTRACT_CAPTURE, report = process.env.MAIL_CONTRACT_REPORT
} = {}) {
    const load = typeof getMailer === 'function' ? getMailer : () => getMailer;
    const state = {
        violations: [], allowed: false, captured: new Map(), seen: new Set(), checked: 0, mocked: false, unchecked: null
    };
    active = state;

    function record(options) {
        state.seen.add(options);
        state.checked += 1;
        const result = checkMail(options);
        if (!result.ok && !state.allowed) {
            state.violations.push({ test: testState().currentTestName, template: result.template, errors: result.errors });
        }
        if (capture && result.template) {
            const count = (state.captured.get(result.template) || 0) + 1;
            state.captured.set(result.template, count);
            if (count <= 3) {
                fs.mkdirSync(capture, { recursive: true });
                const testFile = path.basename(testState().testPath || 'unknown', '.js').replace(/\W+/g, '_');
                const file = path.join(capture, `${service}-${result.template}-${testFile}-${count}.json`);
                fs.writeFileSync(file, JSON.stringify({ test: testState().currentTestName, mail: options }, null, 2));
            }
        }
    }

    // Wraps sendMail once per module instance.
    function wrap() {
        const mailer = load();
        if (!mailer || typeof mailer.sendMail !== 'function') {
            throw new Error(`${service}: mail contract hook: the mail client has no sendMail function to wrap`);
        }
        if (isJestMock(mailer.sendMail)) state.mocked = true;
        if (mailer.sendMail[HOOKED] || isJestMock(mailer.sendMail)) return;

        const original = mailer.sendMail;
        const wrapped = async function sendMail(options, ...rest) {
            record(options);
            return original.call(this, options, ...rest);
        };
        wrapped[HOOKED] = true;
        mailer.sendMail = wrapped; // eslint-disable-line no-param-reassign
    }

    // The mails a mocked sendMail received in this test; a spy that calls through to the
    // wrapped client has recorded them already.
    function checkMockCalls() {
        const mailer = load();
        if (!mailer || !isJestMock(mailer.sendMail)) return;
        state.mocked = true;
        for (const [options] of mailer.sendMail.mock.calls) {
            if (!state.seen.has(options)) record(options);
        }
    }

    function testFile() {
        const testPath = testState().testPath || 'unknown';
        return path.relative(path.join(__dirname, '..', '..'), testPath).split(path.sep).join('/');
    }

    /* eslint-disable no-undef */
    beforeEach(wrap);

    afterEach(() => {
        checkMockCalls();
        const found = state.violations;
        state.violations = [];
        state.allowed = false;
        if (found.length > 0) {
            const lines = found.map((v) => `  ${v.template || '(no template)'}: ${v.errors.join('; ')}`);
            throw new Error(
                `${service}: ${found.length} mail(s) in this test don't match mailer/contract/mail-templates.json:\n${lines.join('\n')}`
            );
        }
    });

    afterAll(() => {
        const file = testFile();
        if (report) {
            fs.appendFileSync(report, `${JSON.stringify({
                service, file, checked: state.checked, mocked: state.mocked, unchecked: state.unchecked
            })}\n`);
        }
        if (state.mocked && state.checked === 0 && !state.unchecked) {
            throw new Error(
                `${service}: ${file} mocks the mail client, and the mail contract hook checked no mail in it.\n`
                + '  Let the mails reach the hook: keep the calls of a mocked sendMail until the test ends (the hook\n'
                + '  reads them in its afterEach), spy with jest.spyOn(mailer, \'sendMail\') without replacing it, or\n'
                + '  call the real client and answer its request with the mailer mock of test/scripts/mock.js.\n'
                + '  If the file has a reason not to check its mails, say so in it:\n'
                + '  require(\'<path to>/mailer/contract/jest-hook.cjs\').allowUncheckedMails(\'<reason>\');'
            );
        }
    });
    /* eslint-enable no-undef */

    return state;
}

// For a test that sends an invalid mail on purpose (prefer fixing the route), in the test:
//   require('../../../mailer/contract/jest-hook.cjs').allowViolations();
function allowViolations() {
    if (!active) throw new Error('mail contract hook: not installed in this test file');
    active.allowed = true;
}

// For a test file that mocks the mail client and has a reason for the hook to check no mail
// in it, at the top of the file (after the requires):
//   require('../../../mailer/contract/jest-hook.cjs').allowUncheckedMails('<reason>');
function allowUncheckedMails(reason) {
    if (!active) throw new Error('mail contract hook: not installed in this test file');
    if (typeof reason !== 'string' || reason.trim() === '') {
        throw new Error('mail contract hook: allowUncheckedMails needs the reason as a text');
    }
    active.unchecked = reason;
}

module.exports = { install, allowViolations, allowUncheckedMails };

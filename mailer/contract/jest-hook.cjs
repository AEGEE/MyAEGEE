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
// module, say) still gets a client that uses the mock. A test that mocks the mail client
// itself is left alone: its sendMail is a jest mock, not the real client.
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

function install(getMailer, { service, capture = process.env.MAIL_CONTRACT_CAPTURE } = {}) {
    const load = typeof getMailer === 'function' ? getMailer : () => getMailer;
    const state = { violations: [], allowed: false, captured: new Map() };
    active = state;

    function record(options) {
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
        if (mailer.sendMail[HOOKED] || isJestMock(mailer.sendMail)) return;

        const original = mailer.sendMail;
        const wrapped = async function sendMail(options, ...rest) {
            record(options);
            return original.call(this, options, ...rest);
        };
        wrapped[HOOKED] = true;
        mailer.sendMail = wrapped; // eslint-disable-line no-param-reassign
    }

    /* eslint-disable no-undef */
    beforeEach(wrap);

    afterEach(() => {
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
    /* eslint-enable no-undef */

    return state;
}

// For a test that sends an invalid mail on purpose (prefer fixing the route), in the test:
//   require('../../../mailer/contract/jest-hook.cjs').allowViolations();
function allowViolations() {
    if (!active) throw new Error('mail contract hook: not installed in this test file');
    active.allowed = true;
}

module.exports = { install, allowViolations };

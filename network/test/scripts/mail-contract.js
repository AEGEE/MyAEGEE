// Checks every mail this service sends in its tests against the mail contract
// (mailer/contract/mail-templates.json, see mailer/contract/README.md). The mail client is
// required before each test, so that the test file's jest.mock() calls apply to it.
// eslint-disable-next-line global-require
require('../../../mailer/contract/jest-hook.cjs').install(() => require('../../lib/mailer'), { service: 'network' });

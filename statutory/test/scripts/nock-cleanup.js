// Capture the real socket transport before Nock installs its interceptors.
require('../../../packages/backend-test-utils/unmocked-request');

// Jest gives each file a module environment, but Nock patches shared Node HTTP APIs.
// Restore them before the next environment installs its own interceptors.
afterAll(() => {
    // Load lazily so suites without HTTP mocks keep real TCP connection semantics.
    // eslint-disable-next-line global-require
    const { default: nock } = require('nock');
    nock.cleanAll();
    nock.restore();
});

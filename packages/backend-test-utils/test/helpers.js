// Shared setup for the helper's own tests. The helpers resolve ajv, yaml, express and
// istanbul-lib-coverage from a service; these tests use core's install for that.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const REQUIRE_FROM = path.join(REPO_ROOT, 'core', 'package.json');
const FIXTURES = path.join(__dirname, 'fixtures');

const requireFromService = createRequire(REQUIRE_FROM);

function tmpDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `backend-test-utils-${prefix}-`));
}

module.exports = { REPO_ROOT, REQUIRE_FROM, FIXTURES, requireFromService, tmpDir };

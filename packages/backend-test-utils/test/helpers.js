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

// A minimal OpenAPI 3.1 document with one operation, GET /x, whose 200 response has
// the given JSON schema (or the given content), for specs that break one rule each.
function minimalSpec({ schema, content, responses, schemas = {}, operation = {}, extra = {} } = {}) {
    return {
        openapi: '3.1.1',
        info: { title: 'x', version: '1' },
        paths: {
            '/x': {
                get: {
                    operationId: 'getX',
                    responses: responses || {
                        200: { description: 'ok', content: content || { 'application/json': { schema } } }
                    },
                    ...operation
                }
            }
        },
        components: { schemas: { ...schemas } },
        ...extra
    };
}

// Writes a spec (JSON is valid YAML) to a fresh directory and returns the directory.
function writeSpec(spec) {
    const dir = tmpDir('spec');
    fs.writeFileSync(path.join(dir, 'openapi.yaml'), JSON.stringify(spec, null, 2));
    return dir;
}

module.exports = { REPO_ROOT, REQUIRE_FROM, FIXTURES, requireFromService, tmpDir, minimalSpec, writeSpec };

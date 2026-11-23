// A run with E2E_COVERAGE=1 starts without the coverage files of earlier runs of its suite.
// Run: node --test scripts/   (part of `npm run lint`)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { clearSuiteData } from '../support/coverage.ts';

test('clearing a suite removes its files and leaves the other suite alone', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-coverage-'));
    const raw = path.join(root, 'raw');
    const routes = path.join(root, 'routes');
    try {
        for (const dir of [raw, routes]) {
            fs.mkdirSync(dir);
            for (const name of ['mocked-100-0.json', 'mocked-100-1.json', 'real-200-0.json', 'notes.txt']) fs.writeFileSync(path.join(dir, name), '{}');
        }

        assert.equal(clearSuiteData('mocked', [raw, routes, path.join(root, 'missing')]), 4);

        assert.deepEqual(fs.readdirSync(raw).sort(), ['notes.txt', 'real-200-0.json']);
        assert.deepEqual(fs.readdirSync(routes).sort(), ['notes.txt', 'real-200-0.json']);
        assert.equal(clearSuiteData('mocked', [raw, routes]), 0);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

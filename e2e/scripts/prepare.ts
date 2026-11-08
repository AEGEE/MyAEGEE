// Prepares the e2e environment: recreates the databases, seeds core, applies
// the e2e fixtures and builds the frontend into e2e/.frontend-dist.
// Usage: node scripts/prepare.ts [--skip-frontend]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'e2e',
    LOGLEVEL: process.env.LOGLEVEL || 'warn'
};

const run = (command: string, cwd: string, { ignoreErrors = false } = {}): void => {
    console.log(`[e2e prepare] ${path.relative(root, cwd) || '.'}$ ${command}`);
    try {
        execSync(command, { cwd, env, stdio: 'inherit' });
    } catch (err) {
        if (!ignoreErrors) throw err;
    }
};

for (const service of ['core', 'events', 'summeruniversity']) {
    const cwd = path.join(root, service);
    run('npx sequelize db:drop', cwd, { ignoreErrors: true });
    run('npx sequelize db:create', cwd);
    run('npx sequelize db:migrate', cwd);
}

fs.rmSync(path.join(root, 'core/state/.seed-executed-e2e'), { force: true });
run('node --experimental-repl-await scripts/seed.js', path.join(root, 'core'));
run('node scripts/core-fixtures.ts', path.join(root, 'e2e'));

if (!process.argv.includes('--skip-frontend')) {
    // vue-cli keeps an existing NODE_ENV, so set it explicitly to get the production build.
    env.NODE_ENV = 'production';
    run(`npx vue-cli-service build --dest ${path.join(root, 'e2e/.frontend-dist')}`, path.join(root, 'frontend'));
}

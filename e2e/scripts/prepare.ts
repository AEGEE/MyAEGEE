// Prepares the e2e environment: recreates the databases, seeds core and builds the
// frontends: the Vue app into e2e/.frontend-dist (and e2e/.frontend-coexist-dist, see
// support/frontend-routing.ts) and the React app (frontend-react/) into e2e/.frontend-react-dist.
// Tests create any other data they need themselves.
// Usage: node scripts/prepare.ts [--skip-frontend | --frontend-only]
//   --frontend-only  only build the frontends (all the mocked-API suite needs)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'e2e',
    LOGLEVEL: process.env.LOGLEVEL || 'warn'
};

const run = (command: string, cwd: string, { ignoreErrors = false, env: extraEnv = {} } = {}): void => {
    console.log(`[e2e prepare] ${path.relative(root, cwd) || '.'}$ ${command}`);
    try {
        execSync(command, { cwd, env: { ...env, ...extraEnv }, stdio: 'inherit' });
    } catch (err) {
        if (!ignoreErrors) throw err;
    }
};

const frontendOnly = process.argv.includes('--frontend-only');

for (const service of frontendOnly ? [] : ['core', 'events', 'summeruniversity']) {
    const cwd = path.join(root, service);
    run('npx sequelize db:drop', cwd, { ignoreErrors: true });
    run('npx sequelize db:create', cwd);
    run('npx sequelize db:migrate', cwd);
}

if (!frontendOnly) {
    fs.rmSync(path.join(root, 'core/state/.seed-executed-e2e'), { force: true });
    run('node --experimental-repl-await scripts/seed.js', path.join(root, 'core'));
}

if (!process.argv.includes('--skip-frontend')) {
    // vue-cli keeps an existing NODE_ENV, so set it explicitly to get the production build.
    env.NODE_ENV = 'production';
    run(`npx vue-cli-service build --dest ${path.join(root, 'e2e/.frontend-dist')}`, path.join(root, 'frontend'));
    // The same, but its links to the pages the React app took over (src/migrated-routes.json)
    // load them from the gateway. Served next to the React build (support/frontend-routing.ts).
    run(`npx vue-cli-service build --dest ${path.join(root, 'e2e/.frontend-coexist-dist')}`, path.join(root, 'frontend'), { env: { VUE_APP_REACT_ROUTES: 'true' } });
    run(`npx vite build --outDir ${path.join(root, 'e2e/.frontend-react-dist')} --emptyOutDir`, path.join(root, 'frontend-react'));
}

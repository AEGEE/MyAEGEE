// Prepares the e2e environment: recreates the databases, seeds core and builds
// the frontend into e2e/.frontend-dist. Tests create any other data they need themselves.
// The databases are those of the chosen E2E_SLOT (support/constants.ts).
// Usage: node scripts/prepare.ts [--skip-frontend | --frontend-only]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { serviceEnv, type Service } from '../support/constants.ts';

const root = path.resolve(import.meta.dirname, '../..');
const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'e2e',
    LOGLEVEL: process.env.LOGLEVEL || 'warn'
};

const skipFrontend = process.argv.includes('--skip-frontend');
const frontendOnly = process.argv.includes('--frontend-only');
if (skipFrontend && frontendOnly) {
    throw new Error('--skip-frontend and --frontend-only together leave nothing to do.');
}

const run = (command: string, cwd: string, { ignoreErrors = false, extraEnv = {} as Record<string, string> } = {}): void => {
    console.log(`[e2e prepare] ${path.relative(root, cwd) || '.'}$ ${command}`);
    try {
        execSync(command, { cwd, env: { ...env, ...extraEnv }, stdio: 'inherit' });
    } catch (err) {
        if (!ignoreErrors) throw err;
    }
};

const services: Service[] = ['core', 'events', 'summeruniversity', 'statutory', 'network', 'discounts'];

if (!frontendOnly) {
    for (const service of services) {
        const cwd = path.join(root, service);
        const extraEnv = serviceEnv(service);
        run('npx sequelize db:drop', cwd, { ignoreErrors: true, extraEnv });
        run('npx sequelize db:create', cwd, { extraEnv });
        run('npx sequelize db:migrate', cwd, { extraEnv });
    }

    fs.rmSync(path.join(root, 'core/state/.seed-executed-e2e'), { force: true });
    run('node --experimental-repl-await scripts/seed.js', path.join(root, 'core'), { extraEnv: serviceEnv('core') });
}

if (!skipFrontend) {
    // One build for all suites. By default it is the production build with the code of
    // frontend/src instrumented for coverage and not minified (frontend/vue.config.js), so
    // what the tests run is what gets measured. E2E_FRONTEND_BUILD=production gives the plain
    // production build, to chase a bug that only shows up minified.
    const build = process.env.E2E_FRONTEND_BUILD ?? 'coverage';
    if (build !== 'coverage' && build !== 'production') {
        throw new Error(`E2E_FRONTEND_BUILD is "${build}": it can be "production", or unset for the instrumented build.`);
    }

    // The instrumented build writes what the coverage report needs next to the app: every
    // file's empty coverage and the compiled templates. Nothing of an older build may stay,
    // and what earlier runs collected belongs to that older build too.
    const coverageDir = path.join(root, 'e2e/.coverage/build');
    fs.rmSync(path.join(root, 'e2e/.coverage'), { recursive: true, force: true });
    delete env.FRONTEND_COVERAGE;
    delete env.FRONTEND_COVERAGE_DIR;
    if (build === 'coverage') {
        env.FRONTEND_COVERAGE = '1';
        env.FRONTEND_COVERAGE_DIR = coverageDir;
    }

    // vue-cli keeps an existing NODE_ENV, so set it explicitly to get the production build.
    env.NODE_ENV = 'production';
    run(`npx vue-cli-service build --dest ${path.join(root, 'e2e/.frontend-dist')}`, path.join(root, 'frontend'));
}

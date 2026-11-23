// Removes what the real-stack suite keeps for one slot: the six databases `<service>-e2e`
// (with the suffix of the slot, `core-e2e-s2`) and the slot's media folder. For a checkout
// that is done with its slot, so the shared Postgres doesn't fill up with databases nobody
// uses. `npm run setup` makes them again.
// Usage: E2E_SLOT=2 node scripts/drop-databases.ts   (npm run teardown)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { SLOT, serviceEnv, type Service } from '../support/constants.ts';

const root = path.resolve(import.meta.dirname, '../..');
const services: Service[] = ['core', 'events', 'summeruniversity', 'statutory', 'network', 'discounts'];

let failed = 0;
for (const service of services) {
    const env = serviceEnv(service);
    console.log(`[e2e teardown] slot ${SLOT}: dropping ${env.E2E_DB_NAME}`);
    try {
        // sequelize-cli drops with IF EXISTS, so a database that was never made is no error.
        execSync('npx sequelize db:drop', { cwd: path.join(root, service), env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'inherit'] });
    } catch {
        failed++;
        console.error(`[e2e teardown] could not drop ${env.E2E_DB_NAME}: is a stack of this slot still running, or is the Postgres down?`);
    }
}

const media = serviceEnv('core').E2E_MEDIA_ROOT;
fs.rmSync(media, { recursive: true, force: true });
fs.rmSync(path.join(root, 'core/state/.seed-executed-e2e'), { force: true });
console.log(`[e2e teardown] slot ${SLOT}: removed ${media}`);

if (failed > 0) process.exit(1);

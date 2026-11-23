// Root-level shared helper; becomes a workspace package after the pnpm restructure.
const { resetHitsFile } = require('../../../packages/backend-test-utils/openapi');

// Starts the OpenAPI hits file of this run afresh (when OPENAPI_HITS_FILE is set), and
// picks one faker seed for the whole run (or takes FAKER_SEED) and prints it,
// so a run that failed on random data can be replayed with the same data.
module.exports = () => {
    resetHitsFile();

    if (!process.env.FAKER_SEED) {
        process.env.FAKER_SEED = String(Math.floor(Math.random() * 2 ** 31));
    }

    // eslint-disable-next-line no-console
    console.log(`\nfaker seed: ${process.env.FAKER_SEED} (replay with FAKER_SEED=${process.env.FAKER_SEED})\n`);
};

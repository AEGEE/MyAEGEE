// Picks one faker seed for the whole run (or takes FAKER_SEED) and prints it,
// so a run that failed on random data can be replayed with the same data.
module.exports = () => {
    if (!process.env.FAKER_SEED) {
        process.env.FAKER_SEED = String(Math.floor(Math.random() * 2 ** 31));
    }

    // eslint-disable-next-line no-console
    console.log(`\nfaker seed: ${process.env.FAKER_SEED} (replay with FAKER_SEED=${process.env.FAKER_SEED})\n`);
};
